<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $productIdParam = trim((string)($_GET['product_id'] ?? ''));
    if (!ctype_digit($productIdParam)) {
        send_json_error(400, 'Invalid product_id');
    }
    $productId = (int)$productIdParam;

    $stmt = $conn->prepare('SELECT seller_id FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }
    $stmt->bind_param('i', $productId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $result = $stmt->get_result();
    $productRow = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$productRow) {
        send_json_error(404, 'Product not found');
    }

    $sellerId = (int)$productRow['seller_id'];
    if ($sellerId !== $userId) {
        send_json_error(403, 'You are not authorized to view buyer ratings for this product');
    }

    $stmt = $conn->prepare(
        'SELECT rating_id, product_id, seller_user_id, buyer_user_id, rating, review_text, created_at, updated_at
         FROM buyer_ratings 
         WHERE seller_user_id = ? AND product_id = ?
         LIMIT 1'
    );
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }
    $stmt->bind_param('ii', $userId, $productId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $result = $stmt->get_result();
    $rating = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$rating) {
        send_json_success([
            'has_rating' => false,
            'rating' => null
        ]);
    }

    $ratingData = [
        'rating_id' => (int)$rating['rating_id'],
        'product_id' => (int)$rating['product_id'],
        'seller_user_id' => (int)$rating['seller_user_id'],
        'buyer_user_id' => (int)$rating['buyer_user_id'],
        'rating' => (float)$rating['rating'],
        'review_text' => $rating['review_text'] ?? '',
        'created_at' => $rating['created_at'],
        'updated_at' => $rating['updated_at']
    ];

    send_json_success([
        'has_rating' => true,
        'rating' => $ratingData
    ]);

} catch (Throwable $e) {
    error_log('get_buyer_rating.php error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}

