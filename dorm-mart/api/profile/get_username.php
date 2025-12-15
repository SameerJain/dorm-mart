<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/profile_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$conn = $result['conn'];

try {
    $requestedId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    if ($requestedId <= 0) {
        send_json_error(400, 'Invalid user_id');
    }

    $stmt = $conn->prepare('SELECT email FROM user_accounts WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }
    $stmt->bind_param('i', $requestedId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row || empty($row['email'])) {
        send_json_error(404, 'User not found');
    }

    $username = derive_username((string)$row['email']);

    send_json_success([
        'user_id' => $requestedId,
        'username' => $username,
    ]);
} catch (Throwable $e) {
    error_log('get_username.php error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}
