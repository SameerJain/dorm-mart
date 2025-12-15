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
    
    // Validate product ID
    $productId = validate_product_id($input);

    $stmt = $conn->prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare delete');
    }
    $stmt->bind_param('ii', $userId, $productId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }

    if ($stmt->affected_rows < 1) {
        $stmt->close();
        send_json_error(404, 'Product not in wishlist');
    }
    $stmt->close();

    $updateStmt = $conn->prepare('UPDATE INVENTORY SET wishlisted = GREATEST(wishlisted - 1, 0) WHERE product_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('i', $productId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    $notifStmt = $conn->prepare(
        'UPDATE wishlist_notification
        SET unread_count = CASE
            WHEN unread_count > 0 THEN unread_count - 1
            ELSE 0
        END
        WHERE product_id = ?'
    );
    if ($notifStmt) {
        $notifStmt->bind_param('i', $productId);
        $notifStmt->execute();
        $notifStmt->close();
    }

    send_json_success(['product_id' => $productId]);
} catch (Throwable $e) {
    error_log('remove_from_wishlist error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

