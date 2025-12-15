<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';

// Bootstrap API with POST method (no auth required - this is the login endpoint)
// Note: We need to handle session initialization manually for rate limiting
api_bootstrap('POST', false);

// Initialize session for rate limiting (must be done before checking rate limits)
auth_boot_session();

// Parse request data (handles both JSON and form data)
$data = get_request_data();
$emailRaw = strtolower(trim((string)($data['email'] ?? '')));
$passwordRaw = (string)($data['password'] ?? '');

if (containsXSSPattern($emailRaw)) {
    send_json_error(400, 'Only University at Buffalo email addresses are permitted (@buffalo.edu)');
}

$email = validateInput($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
$password = validateInput($passwordRaw, 64);

if ($email === false || $password === false) {
    if ($email === false) {
        send_json_error(400, 'Only University at Buffalo email addresses are permitted (@buffalo.edu)');
    } else {
        send_json_error(400, 'Invalid password format. Please check your password.');
    }
}

if ($email === '' || $password === '') {
    send_json_error(400, 'Missing required fields');
}
if (strlen($email) > 255 || strlen($password) > 64) {
    send_json_error(400, 'Username or password is too large');
}
if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
    send_json_error(400, 'Only University at Buffalo email addresses are permitted (@buffalo.edu)');
}

try {
    // Check rate limiting first (uses session ID)
    $sessionId = session_id();
    $rateLimitCheck = check_rate_limit($sessionId);
    if ($rateLimitCheck['blocked']) {
        // Session is locked out - show lockout error regardless of credential validity
        $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
        // Ensure at least 1 minute is shown if lockout is still active
        $displayMinutes = max(1, $remainingMinutes);
        send_json_error(429, "Too many failed attempts. Please try again in {$displayMinutes} minute" . ($displayMinutes > 1 ? 's' : '') . ".");
    }

    $conn = db();
    
    $stmt = $conn->prepare('SELECT user_id, hash_pass FROM user_accounts WHERE email = ? LIMIT 1');
    if (!$stmt) {
        $conn->close();
        send_json_error(500, 'Database error');
    }
    $stmt->bind_param('s', $email);
    if (!$stmt->execute()) {
        $stmt->close();
        $conn->close();
        send_json_error(500, 'Database error');
    }
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        $stmt->close();
        $conn->close();
        
        // Record failed attempt for non-existent user (but don't reveal this)
        // Use session ID instead of email for rate limiting
        record_failed_attempt($sessionId);
        
        send_json_error(401, 'Invalid credentials');
    }
    $row = $res->fetch_assoc();
    $stmt->close();

    if (!password_verify($password, (string)$row['hash_pass'])) {
        $conn->close();
        
        // Record failed attempt
        // Use session ID instead of email for rate limiting
        record_failed_attempt($sessionId);
        
        send_json_error(401, 'Invalid credentials');
    }

    $userId = (int)$row['user_id'];
    
    $themeStmt = $conn->prepare('SELECT theme FROM user_accounts WHERE user_id = ?');
    if (!$themeStmt) {
        $conn->close();
        send_json_error(500, 'Database error');
    }
    $themeStmt->bind_param('i', $userId);
    if (!$themeStmt->execute()) {
        $themeStmt->close();
        $conn->close();
        send_json_error(500, 'Database error');
    }
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

    send_json_success(['theme' => $theme]);
} catch (Throwable $e) {
    error_log('Login error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}