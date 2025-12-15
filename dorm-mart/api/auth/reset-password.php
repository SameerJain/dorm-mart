<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with POST method (no auth required - this is password reset)
api_bootstrap('POST', false);

// Get request data (IMPORTANT: Do NOT HTML-encode passwords before hashing - use raw input)
$data = get_request_data();
$token = isset($data['token']) ? trim((string)$data['token']) : '';
$newPassword = isset($data['newPassword']) ? (string)$data['newPassword'] : '';

// Validate inputs
if (empty($token) || empty($newPassword)) {
    send_json_error(400, 'Token and new password are required');
}

// Validate password policy
$MAX_LEN = 64;
if (strlen($newPassword) > $MAX_LEN) {
    send_json_error(400, 'Password is too long. Maximum length is 64 characters.');
}

if (
    strlen($newPassword) < 8
    || !preg_match('/[a-z]/', $newPassword)
    || !preg_match('/[A-Z]/', $newPassword)
    || !preg_match('/\d/', $newPassword)
    || !preg_match('/[^A-Za-z0-9]/', $newPassword)
) {
    send_json_error(400, 'Password does not meet policy requirements');
}

try {
    $conn = get_db();
    
    $stmt = $conn->prepare('
        SELECT user_id, hash_auth, reset_token_expires 
        FROM user_accounts 
        WHERE hash_auth IS NOT NULL 
        AND reset_token_expires > NOW()
    ');
    $stmt->execute();
    $result = $stmt->get_result();

    $isValidToken = false;
    $userId = null;
    
    while ($row = $result->fetch_assoc()) {
        if (password_verify($token, $row['hash_auth'])) {
            $isValidToken = true;
            $userId = $row['user_id'];
            break;
        }
    }

    $stmt->close();

    if (!$isValidToken) {
        $conn->close();
        send_json_error(400, 'Invalid or expired reset token');
    }

    // Hash the new password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);

    $stmt = $conn->prepare('
        UPDATE user_accounts 
        SET hash_pass = ?, hash_auth = NULL, reset_token_expires = NULL 
        WHERE user_id = ?
    ');
    $stmt->bind_param('si', $hashedPassword, $userId);  // 's' = string, 'i' = integer
    $stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        $stmt->close();
        $conn->close();
        send_json_error(500, 'Failed to update password');
    }

    $stmt->close();
    $conn->close();

    send_json_success(['message' => 'Password has been reset successfully']);
    
} catch (Exception $e) {
    error_log('reset-password error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}
?>
