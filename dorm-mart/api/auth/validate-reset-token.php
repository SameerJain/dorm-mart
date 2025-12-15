<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with GET method (no auth required - this validates reset tokens)
api_bootstrap('GET', false);

$token = $_GET['token'] ?? '';

if (empty($token)) {
    send_json_error(400, 'Token required');
}

try {
    $conn = get_db();
    
    // Check if token is valid and not expired
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
    $conn->close();

    if ($isValidToken) {
        send_json_success([
            'valid' => true,
            'user_id' => $userId,
            'message' => 'Token is valid'
        ]);
    } else {
        send_json_success([
            'valid' => false,
            'message' => 'Token is invalid or expired'
        ]);
    }
    
} catch (Exception $e) {
    error_log('validate-reset-token error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}
?>

