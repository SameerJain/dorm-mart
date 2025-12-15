<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../auth/auth_handle.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $input = get_request_data();

    // Validate CSRF token if provided
    validate_csrf_optional($input);

    // Reset unread_count to 0 for all products for this seller
    $stmt = $conn->prepare(
        'UPDATE wishlist_notification
         SET unread_count = 0
         WHERE seller_id = ? AND unread_count > 0'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare update');
    }

    $stmt->bind_param('i', $userId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $affected = $stmt->affected_rows;
    $stmt->close();

    send_json_success(['rows_affected' => $affected]);
} catch (Throwable $e) {
    error_log('mark_all_items_read error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}
