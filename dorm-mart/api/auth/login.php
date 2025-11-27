<?php

declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// HTTPS enforcement for production (exclude localhost for development)
$isLocalhost = (
    ($_SERVER['HTTP_HOST'] ?? '') === 'localhost' ||
    ($_SERVER['HTTP_HOST'] ?? '') === 'localhost:8080' ||
    strpos($_SERVER['HTTP_HOST'] ?? '', '127.0.0.1') === 0
);

if (!$isLocalhost && (!isset($_SERVER['HTTPS']) || $_SERVER['HTTPS'] !== 'on')) {
    $httpsUrl = 'https://' . ($_SERVER['HTTP_HOST'] ?? '') . ($_SERVER['REQUEST_URI'] ?? '');
    header("Location: $httpsUrl", true, 301);
    exit;
}

require __DIR__ . '/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

// Initialize session for rate limiting (must be done before checking rate limits)
auth_boot_session();

// Respond to CORS preflight after setting CORS headers
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Rate limiting will be checked after recording failed attempts
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
    $raw  = file_get_contents('php://input');
    // XSS PROTECTION: Decode JSON first, then validate individual fields (don't HTML-encode JSON)
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid JSON format']);
        exit;
    }
    
    $emailRaw = strtolower(trim((string)($data['email'] ?? '')));
    $passwordRaw = (string)($data['password'] ?? '');
} else {
    $emailRaw = strtolower(trim((string)($_POST['email'] ?? '')));
    $passwordRaw = (string)($_POST['password'] ?? '');
}

// XSS PROTECTION: Check for XSS patterns in email field (single check, no duplication)
// Note: SQL injection is already prevented by prepared statements
if (containsXSSPattern($emailRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Only University at Buffalo email addresses are permitted (@buffalo.edu)']);
    exit;
}

$email = validateInput($emailRaw, 50, '/^[^@\s]+@buffalo\.edu$/');
$password = validateInput($passwordRaw, 64);

if ($email === false || $password === false) {
    http_response_code(400);
    // Provide more specific error message
    if ($email === false) {
        // Check if it's because email doesn't match UB format
        if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $emailRaw)) {
            echo json_encode(['ok' => false, 'error' => 'Only University at Buffalo email addresses are permitted (@buffalo.edu)']);
        } else {
            echo json_encode(['ok' => false, 'error' => 'Only University at Buffalo email addresses are permitted (@buffalo.edu)']);
        }
    } else {
        echo json_encode(['ok' => false, 'error' => 'Invalid password format. Please check your password.']);
    }
    exit;
}

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
    exit;
}
if (strlen($email) >= 50 || strlen($password) >= 64) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Username or password is too large']);
    exit;
}
if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Only University at Buffalo email addresses are permitted (@buffalo.edu)']);
    exit;
}

try {
    // CRITICAL: Check rate limiting FIRST, before any password verification
    // This ensures lockout error is shown regardless of whether credentials are valid or invalid
    // Use session ID instead of email for rate limiting
    $sessionId = session_id();
    $rateLimitCheck = check_rate_limit($sessionId);
    if ($rateLimitCheck['blocked']) {
        // Session is locked out - show lockout error regardless of credential validity
        $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
        // Ensure at least 1 minute is shown if lockout is still active
        $displayMinutes = max(1, $remainingMinutes);
        http_response_code(429);
        echo json_encode(['ok' => false, 'error' => "Too many failed attempts. Please try again in {$displayMinutes} minute" . ($displayMinutes > 1 ? 's' : '') . "."]);
        exit;
    }

    $conn = db();
    
    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Using mysqli prepared statements with parameter binding (bind_param) to prevent SQL injection.
    // The '?' placeholder ensures user input ($email) is treated as data, not executable SQL.
    // Even if malicious SQL is in $email, it cannot execute because it's bound as a string parameter.
    // This is the industry-standard defense against SQL injection attacks.
    // ============================================================================
    $stmt = $conn->prepare('SELECT user_id, hash_pass FROM user_accounts WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);  // 's' = string type, $email is safely bound as parameter
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        $stmt->close();
        $conn->close();
        
        // Record failed attempt for non-existent user (but don't reveal this)
        // Use session ID instead of email for rate limiting
        record_failed_attempt($sessionId);
        
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid credentials']);
        exit;
    }
    $row = $res->fetch_assoc();
    $stmt->close();

    // SECURITY NOTE: password_verify() safely checks the submitted
    // plaintext against the STORED salted hash from password_hash(). The salt is
    // inside the hash; we never store or handle it separately.
    if (!password_verify($password, (string)$row['hash_pass'])) {
        $conn->close();
        
        // Record failed attempt
        // Use session ID instead of email for rate limiting
        record_failed_attempt($sessionId);
        
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid credentials']);
        exit;
    }

    $userId = (int)$row['user_id'];
    
    // SQL INJECTION PROTECTION: Prepared statement for theme query (user_id parameter bound safely)
    $themeStmt = $conn->prepare('SELECT theme FROM user_accounts WHERE user_id = ?');
    $themeStmt->bind_param('i', $userId);  // 'i' = integer type
    $themeStmt->execute();
    $themeRes = $themeStmt->get_result();
    $themeRow = $themeRes->fetch_assoc();
    $themeStmt->close();
    $conn->close();
    
    // Clear rate limiting data on successful login BEFORE regenerating session ID
    // This prevents the new session from inheriting any lockout state
    require_once __DIR__ . '/../security/security.php';
    reset_failed_attempts($sessionId);
    
    $theme = 'light'; // default
    if ($themeRow && isset($themeRow['theme'])) {
        $theme = $themeRow['theme'] ? 'dark' : 'light';
    }

    // Regenerate session ID to prevent session fixation attacks
    // This happens AFTER clearing rate limits to ensure old session data is cleared
    regenerate_session_on_login();
    $_SESSION['user_id'] = $userId;

    // Persist across restarts
    issue_remember_cookie($userId);

    echo json_encode(['ok' => true, 'theme' => $theme]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Server error']);
}