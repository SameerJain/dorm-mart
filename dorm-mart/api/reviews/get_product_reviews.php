<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../profile/profile_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    // Validate product_id
    $productId = validate_product_id($_GET, 'product_id');

    // Verify that the current user is the seller of this product
    $stmt = $conn->prepare('SELECT seller_id FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare product lookup');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $productRow = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$productRow) {
        send_json_error(404, 'Product not found');
    }

    $sellerId = (int)$productRow['seller_id'];
    if ($sellerId !== $userId) {
        send_json_error(403, 'You are not authorized to view reviews for this product');
    }

    // Get all reviews for this product
    $stmt = $conn->prepare(
        'SELECT pr.review_id, pr.product_id, pr.buyer_user_id, pr.seller_user_id,
                pr.rating, pr.product_rating, pr.review_text, pr.image1_url, pr.image2_url, pr.image3_url,
                pr.created_at, pr.updated_at,
                ua.first_name, ua.last_name, ua.email
         FROM product_reviews pr
         LEFT JOIN user_accounts ua ON pr.buyer_user_id = ua.user_id
         WHERE pr.product_id = ?
         ORDER BY pr.created_at DESC'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare reviews lookup');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $reviews = [];
    while ($row = $result->fetch_assoc()) {
        $buyerName = build_seller_name($row);
        if ($buyerName === 'Unknown Seller') {
            $buyerName = 'Buyer #' . $row['buyer_user_id'];
        }

        // XSS PROTECTION: Escape user-generated content before returning in JSON
        $reviews[] = [
            'review_id' => (int)$row['review_id'],
            'product_id' => (int)$row['product_id'],
            'buyer_user_id' => (int)$row['buyer_user_id'],
            'seller_user_id' => (int)$row['seller_user_id'],
            'rating' => (float)$row['rating'],
            'product_rating' => isset($row['product_rating']) ? (float)$row['product_rating'] : null,
            'review_text' => $row['review_text'], // Note: No HTML encoding needed for JSON - React handles XSS protection
            'image1_url' => $row['image1_url'] ?? null,
            'image2_url' => $row['image2_url'] ?? null,
            'image3_url' => $row['image3_url'] ?? null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'buyer_name' => $buyerName,
            'buyer_email' => $row['email'] ?? ''
        ];
    }
    
    $stmt->close();

    send_json_success([
        'count' => count($reviews),
        'reviews' => $reviews
    ]);

} catch (Throwable $e) {
    error_log('get_product_reviews.php error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

