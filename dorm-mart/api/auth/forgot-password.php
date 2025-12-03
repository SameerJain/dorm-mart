<?php

declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();

header('Content-Type: application/json; charset=utf-8');

// SECURE CORS Configuration
setSecureCORS();

// Include PHPMailer setup (reuse from create_account.php)
$PROJECT_ROOT = dirname(__DIR__, 2);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} else {
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/PHPMailer.php';
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/SMTP.php';
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/Exception.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Load environment variables (same as create_account.php)
foreach (["$PROJECT_ROOT/.env.development", "$PROJECT_ROOT/.env.local", "$PROJECT_ROOT/.env.production", "$PROJECT_ROOT/.env.cattle"] as $envFile) {
    if (is_readable($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) continue;
            [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
            putenv(trim($k) . '=' . trim($v));
        }
        break;
    }
}

// Use the EXACT same email sending logic as create_account.php for maximum speed
function sendPasswordResetEmail(array $user, string $resetLink, string $envLabel = 'Local'): array
{
    global $PROJECT_ROOT;

    // Load environment variables (EXACT same as create_account.php)
    // Ensures Gmail credentials are properly loaded for email sending
    foreach (["$PROJECT_ROOT/.env.development", "$PROJECT_ROOT/.env.local", "$PROJECT_ROOT/.env.production", "$PROJECT_ROOT/.env.cattle"] as $envFile) {
        if (is_readable($envFile)) {
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) continue;
                [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
                putenv(trim($k) . '=' . trim($v));
            }
            break;
        }
    }

    // Ensure PHP is using UTF-8 internally (EXACT same as create_account.php)
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        // SMTP Configuration (EXACT same as create_account.php)
        // Uses Gmail SMTP with SSL encryption for secure email delivery
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('GMAIL_USERNAME');
        $mail->Password   = getenv('GMAIL_PASSWORD');
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;

        // Optimizations for faster email delivery
        $mail->Timeout = 30; // Reduced timeout for faster failure detection
        $mail->SMTPKeepAlive = false; // Close connection after sending
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Tell PHPMailer we are sending UTF-8 and how to encode it (EXACT same as create_account.php)
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64';

        // From/To (EXACT same as create_account.php)
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
        $mail->addAddress($user['email'], trim($user['first_name'] . ' ' . $user['last_name']));

        // XSS PROTECTION: Encoding (Layer 2) - HTML entity encoding (more foolproof than filtering)
        $firstName = escapeHtml($user['first_name'] ?: 'Student');
        $resetLinkEscaped = escapeHtml($resetLink);
        $subject = 'Reset Your Password - Dorm Mart';

        // Simplified email template (minimal like create_account.php)
        $html = <<<HTML
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>{$subject}</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;margin:0;padding:16px;background:#111;">
    <div style="max-width:640px;margin:0 auto;background:#1e1e1e;border-radius:8px;padding:20px;">
      <p style="color:#eee;">Dear {$firstName},</p>
      <p style="color:#eee;">You requested to reset your password for your Dorm Mart account.</p>
      <p style="margin:20px 0;">
        <a href="{$resetLinkEscaped}" style="background:#007bff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Reset Password</a>
      </p>
      <p style="color:#eee;">This link will expire in 1 hour for security reasons.</p>
      <p style="color:#eee;">Best regards,<br/>The Dorm Mart Team</p>
      <hr style="border:none;border-top:1px solid #333;margin:16px 0;">
      <p style="font-size:12px;color:#aaa;">This is an automated message; do not reply. For support:
      <a href="mailto:dormmartsupport@gmail.com" style="color:#9db7ff;">dormmartsupport@gmail.com</a></p>
    </div>
  </body>
</html>
HTML;

        // Plain-text version for faster delivery (no HTML escaping needed for plain text)
        $firstNamePlain = $user['first_name'] ?: 'Student';
        $text = <<<TEXT
Dear {$firstNamePlain},

You requested to reset your password for your Dorm Mart account.

Click this link to reset your password:
{$resetLink}

This link will expire in 1 hour for security reasons.

Best regards,
The Dorm Mart Team

(This is an automated message; do not reply. Support: dormmartsupport@gmail.com)
TEXT;

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $html;
        $mail->AltBody = $text;

        $sendStartTime = microtime(true);
        $mail->send();
        $sendEndTime = microtime(true);
        $sendDuration = round(($sendEndTime - $sendStartTime) * 1000, 2);
        error_log("PHPMailer send() duration: {$sendDuration}ms");
        return ['success' => true, 'message' => 'Email sent successfully'];
    } catch (Exception $e) {
        return ['success' => false, 'error' => 'Failed to send email: ' . $e->getMessage()];
    }
}

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../utility/manage_forgot_password_rate_limiting.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Get request data
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
    $raw = file_get_contents('php://input');
    // IMPORTANT: Decode JSON first, then validate - don't HTML-encode email before validation
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $data = [];
    }
    $emailRaw = strtolower(trim((string)($data['email'] ?? '')));
} else {
    $emailRaw = strtolower(trim((string)($_POST['email'] ?? '')));
}

// XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
// Note: SQL injection prevented by prepared statements
if ($emailRaw !== '' && containsXSSPattern($emailRaw)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input format']);
    exit;
}

$email = validateInput($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');

if ($email === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email format']);
    exit;
}

try {
    $conn = db();

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Using prepared statement with '?' placeholder and bind_param() to safely
    // handle $email. Even if malicious SQL is in $email, it cannot execute
    // because it's bound as a string parameter, not concatenated into SQL.
    // ============================================================================
    $stmt = $conn->prepare('SELECT user_id, first_name, last_name, email, last_reset_request FROM user_accounts WHERE email = ?');
    $stmt->bind_param('s', $email);  // 's' = string type, safely bound as parameter
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Email not found']);
        exit;
    }

    $user = $result->fetch_assoc();
    $stmt->close();

    // Check rate limiting (optimized inline check)
    if ($user['last_reset_request']) {
        $stmt = $conn->prepare('SELECT TIMESTAMPDIFF(MINUTE, ?, NOW()) as minutes_passed');
        $stmt->bind_param('s', $user['last_reset_request']);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $minutesPassed = (int)$row['minutes_passed'];
        $stmt->close();

        if ($minutesPassed < 10) { // 10 minute rate limit
            $remainingMinutes = 10 - $minutesPassed;
            $conn->close();
            echo json_encode(['success' => false, 'error' => "Please wait {$remainingMinutes} minutes before requesting another reset link"]);
            exit;
        }
    }

    // Generate reset token (same as login system)
    $resetToken = bin2hex(random_bytes(32));
    $hashedToken = password_hash($resetToken, PASSWORD_BCRYPT);

    // Set expiration to 1 hour from now using UTC timezone
    $expiresAt = (new DateTime('+1 hour', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

    // Store token, expiration, and update timestamp in one query
    $stmt = $conn->prepare('UPDATE user_accounts SET hash_auth = ?, reset_token_expires = ?, last_reset_request = NOW() WHERE user_id = ?');
    $stmt->bind_param('ssi', $hashedToken, $expiresAt, $user['user_id']);
    $stmt->execute();
    $stmt->close();

    // Generate reset link with correct domain
    $baseUrl = get_reset_password_base_url();
    $resetLink = $baseUrl . '/api/redirects/handle_password_reset_token_redirect.php?token=' . $resetToken;

    // Determine environment label for email copy
    $envLabel = 'Local';
    if (strpos($resetLink, 'aptitude.cse.buffalo.edu') !== false) {
        $envLabel = 'Aptitude';
    } elseif (strpos($resetLink, 'cattle.cse.buffalo.edu') !== false) {
        $envLabel = 'Cattle';
    } else {
        // Distinguish local dev methods (npm start vs local Apache) is not visible to recipient;
        // keep it short and generic as "Local".
        $envLabel = 'Local';
    }

    // Send email using the same function as create_account.php
    $emailStartTime = microtime(true);
    $emailResult = sendPasswordResetEmail($user, $resetLink, $envLabel);
    $emailEndTime = microtime(true);
    $emailDuration = round(($emailEndTime - $emailStartTime) * 1000, 2); // milliseconds
    
    // Debug: Log email timing
    error_log("Reset password email duration: {$emailDuration}ms");

    if (!$emailResult['success']) {
        $conn->close();
        echo json_encode(['success' => false, 'error' => 'Failed to send email']);
        exit;
    }

    $conn->close();
    echo json_encode([
        'success' => true,
        'message' => 'Check your email',
        'debug' => [
            'email_duration_ms' => $emailDuration,
            'environment' => $envLabel
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

function get_reset_password_base_url(): string
{
    // Prefer explicit origin/host detection
    $host   = $_SERVER['HTTP_HOST']   ?? '';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // Production server
    if (strpos($host, 'cattle.cse.buffalo.edu') !== false || strpos($origin, 'cattle.cse.buffalo.edu') !== false) {
        return 'https://cattle.cse.buffalo.edu/CSE442/2025-Fall/cse-442j';
    }

    // Test server
    if (strpos($host, 'aptitude.cse.buffalo.edu') !== false || strpos($origin, 'aptitude.cse.buffalo.edu') !== false) {
        return 'https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j';
    }

    // Local development - detect which method is being used
    $isLocal = (
        $host === 'localhost' ||
        $host === 'localhost:8080' ||
        strpos($host, '127.0.0.1') === 0 ||
        strpos($origin, 'http://localhost:3000') === 0 ||
        strpos($origin, 'http://localhost:8080') === 0 ||
        strpos($origin, 'http://127.0.0.1') === 0
    );

    if ($isLocal) {
        // Check if we're running the development server (npm start) vs production build (Apache)
        // Development server: React runs on :3000, PHP API on :8080
        // Production build: Everything served through Apache on :80

        // If the request is coming from React dev server (port 3000), use the PHP dev server
        if (strpos($origin, 'http://localhost:3000') === 0 || strpos($origin, 'http://127.0.0.1:3000') === 0) {
            return 'http://localhost:8080';
        }

        // If the request is coming from Apache (port 80), use the serve folder
        if ($host === 'localhost' || strpos($host, '127.0.0.1') === 0) {
            return 'http://localhost/serve/dorm-mart';
        }

        // Default to PHP dev server for other local cases
        return 'http://localhost:8080';
    }

    // Fallback to test server
    return 'https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j';
}
