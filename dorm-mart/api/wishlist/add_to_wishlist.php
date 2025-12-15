<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

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

    // Verify product exists
    $checkStmt = $conn->prepare('SELECT product_id FROM INVENTORY WHERE product_id = ?');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare product check');
    }
    $checkStmt->bind_param('i', $productId);
    if (!$checkStmt->execute()) {
        $checkStmt->close();
        send_json_error(500, 'Database error');
    }
    $result = $checkStmt->get_result();
    if ($result->num_rows === 0) {
        $checkStmt->close();
        send_json_error(404, 'Product not found');
    }
    $checkStmt->close();

    $checkWishlistStmt = $conn->prepare('SELECT wishlist_id FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$checkWishlistStmt) {
        send_json_error(500, 'Database error');
    }
    $checkWishlistStmt->bind_param('ii', $userId, $productId);
    if (!$checkWishlistStmt->execute()) {
        $checkWishlistStmt->close();
        send_json_error(500, 'Database error');
    }
    $wishlistResult = $checkWishlistStmt->get_result();
    if ($wishlistResult->num_rows > 0) {
        $checkWishlistStmt->close();
        send_json_error(400, 'Product already in wishlist');
    }
    $checkWishlistStmt->close();

    $stmt = $conn->prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare insert');
    }
    $stmt->bind_param('ii', $userId, $productId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $wishlistId = $conn->insert_id;
    $stmt->close();

    $updateStmt = $conn->prepare('UPDATE INVENTORY SET wishlisted = wishlisted + 1 WHERE product_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('i', $productId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    $wnStmt = $conn->prepare('UPDATE wishlist_notification SET unread_count = unread_count + 1 WHERE product_id = ?');
    if ($wnStmt) {
        $wnStmt->bind_param('i', $productId);
        $wnStmt->execute();
        $wnStmt->close();
    }

    send_json_success(['wishlist_id' => $wishlistId, 'product_id' => $productId]);
} catch (Throwable $e) {
    error_log('add_to_wishlist error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

