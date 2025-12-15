<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $input = get_request_data();
    if (!is_array($input)) {
        $input = [];
    }

    $token = $input['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        send_json_error(403, 'CSRF token validation failed');
    }

    $id = isset($input['id']) ? (int)$input['id'] : 0;
    $status = isset($input['status']) ? (string)$input['status'] : '';

    $valid = ['Active', 'Pending', 'Draft', 'Sold'];
    if ($id <= 0 || !in_array($status, $valid, true)) {
        send_json_error(400, 'Invalid id or status');
    }

    $stmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND seller_id = ?');
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }
    $stmt->bind_param('sii', $status, $id, $userId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }

    if ($stmt->affected_rows < 1) {
        $stmt->close();
        send_json_error(404, 'Not found');
    }
    $stmt->close();

    send_json_success(['id' => $id, 'status' => $status]);
} catch (Throwable $e) {
    error_log('set_item_status error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}


