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

    // Get the user's review for this product
    $stmt = $conn->prepare(
        'SELECT pr.review_id, pr.product_id, pr.buyer_user_id, pr.seller_user_id, 
                pr.rating, pr.product_rating, pr.review_text, pr.image1_url, pr.image2_url, pr.image3_url,
                pr.created_at, pr.updated_at,
                ua.first_name, ua.last_name, ua.email
         FROM product_reviews pr
         LEFT JOIN user_accounts ua ON pr.buyer_user_id = ua.user_id
         WHERE pr.buyer_user_id = ? AND pr.product_id = ?
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
    $review = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$review) {
        send_json_success([
            'has_review' => false,
            'review' => null
        ]);
    }

    $buyerName = trim(($review['first_name'] ?? '') . ' ' . ($review['last_name'] ?? ''));
    $reviewData = [
        'review_id' => (int)$review['review_id'],
        'product_id' => (int)$review['product_id'],
        'buyer_user_id' => (int)$review['buyer_user_id'],
        'seller_user_id' => (int)$review['seller_user_id'],
        'rating' => (float)$review['rating'],
        'product_rating' => isset($review['product_rating']) ? (float)$review['product_rating'] : null,
        'review_text' => $review['review_text'],
        'image1_url' => $review['image1_url'] ?? null,
        'image2_url' => $review['image2_url'] ?? null,
        'image3_url' => $review['image3_url'] ?? null,
        'created_at' => $review['created_at'],
        'updated_at' => $review['updated_at'],
        'buyer_name' => $buyerName,
        'buyer_email' => $review['email'] ?? ''
    ];

    send_json_success([
        'has_review' => true,
        'review' => $reviewData
    ]);

} catch (Throwable $e) {
    error_log('get_review.php error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}

