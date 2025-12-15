<?php

declare(strict_types=1);

// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();

header('Content-Type: application/json; charset=utf-8');

// SECURE CORS Configuration
setSecureCORS();

// Include email helpers
require_once __DIR__ . '/../utility/email_helpers.php';
require_once __DIR__ . '/../utility/email_templates.php';

// Load environment variables using centralized loader
require_once __DIR__ . '/../utility/load_env.php';
require_once __DIR__ . '/../utility/env_config.php';
load_env();

/**
 * Send password reset email
 * 
 * @param array $user User data with first_name, last_name, email
 * @param string $resetLink Password reset link
 * @param string $envLabel Environment label (unused, kept for backward compatibility)
 * @return array Result array with 'success' (bool) and 'error'/'message' (string|null)
 */
function sendPasswordResetEmail(array $user, string $resetLink, string $envLabel = 'Local'): array {
    $firstName = $user['first_name'] ?? 'Student';
    $lastName = $user['last_name'] ?? '';
    $email = $user['email'] ?? '';
    
    $template = get_password_reset_email_template($firstName, $resetLink);
    $toName = trim($firstName . ' ' . $lastName);
    
    $sendStartTime = microtime(true);
    $result = send_email($email, $toName, $template['subject'], $template['html'], $template['text']);
    $sendEndTime = microtime(true);
    $sendDuration = round(($sendEndTime - $sendStartTime) * 1000, 2);
    error_log("PHPMailer send() duration: {$sendDuration}ms");
    
    if ($result['success']) {
        return ['success' => true, 'message' => 'Email sent successfully'];
    } else {
        return ['success' => false, 'error' => 'Failed to send email: ' . ($result['error'] ?? 'Unknown error')];
    }
}

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../utility/manage_forgot_password_rate_limiting.php';

// Bootstrap API with POST method (no auth required - this is password reset request)
api_bootstrap('POST', false);

// Get request data (IMPORTANT: Decode JSON first, then validate - don't HTML-encode email before validation)
$data = get_request_data();
$emailRaw = strtolower(trim((string)($data['email'] ?? '')));

// XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
if ($emailRaw !== '' && containsXSSPattern($emailRaw)) {
    send_json_error(400, 'Invalid input format');
}

$email = validateInput($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');

if ($email === false) {
    send_json_error(400, 'Invalid email format');
}

try {
    $conn = get_db();

    $stmt = $conn->prepare('SELECT user_id, first_name, last_name, email, last_reset_request FROM user_accounts WHERE email = ?');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        send_json_error(404, 'Email not found');
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
            send_json_error(429, "Please wait {$remainingMinutes} minutes before requesting another reset link");
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
    $env = get_environment();
    $envLabel = ucfirst($env);

    // Send email using the same function as create_account.php
    $emailStartTime = microtime(true);
    $emailResult = sendPasswordResetEmail($user, $resetLink, $envLabel);
    $emailEndTime = microtime(true);
    $emailDuration = round(($emailEndTime - $emailStartTime) * 1000, 2); // milliseconds
    
    // Debug: Log email timing
    error_log("Reset password email duration: {$emailDuration}ms");

    if (!$emailResult['success']) {
        $conn->close();
        send_json_error(500, 'Failed to send email');
    }

    $conn->close();
    send_json_success([
        'message' => 'Check your email',
        'debug' => [
            'email_duration_ms' => $emailDuration,
            'environment' => $envLabel
        ]
    ]);
} catch (Exception $e) {
    error_log('forgot-password error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

function get_reset_password_base_url(): string
{
    // Use centralized environment configuration
    return get_frontend_base_url();
}
