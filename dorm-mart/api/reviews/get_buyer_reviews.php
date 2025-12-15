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
    // Always use logged-in user's ID for privacy - users can only view their own buyer reviews
    $buyerId = $userId;

    // Get all buyer reviews for this user
    $sql = <<<SQL
SELECT 
    br.rating_id,
    br.product_id,
    br.seller_user_id,
    br.buyer_user_id,
    br.rating,
    br.review_text,
    br.created_at,
    br.updated_at,
    inv.title AS product_title,
    seller.first_name AS seller_first,
    seller.last_name AS seller_last,
    seller.email AS seller_email
FROM buyer_ratings br
LEFT JOIN INVENTORY inv ON br.product_id = inv.product_id
LEFT JOIN user_accounts seller ON br.seller_user_id = seller.user_id
WHERE br.buyer_user_id = ?
ORDER BY br.created_at DESC
SQL;

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare buyer reviews lookup');
    }
    $stmt->bind_param('i', $buyerId);
    $stmt->execute();
    $result = $stmt->get_result();

    $reviews = [];
    while ($row = $result->fetch_assoc()) {
        // Adapt row structure for build_seller_name helper
        $sellerRow = [
            'first_name' => $row['seller_first'] ?? '',
            'last_name' => $row['seller_last'] ?? '',
            'email' => $row['seller_email'] ?? ''
        ];
        $sellerName = build_seller_name($sellerRow);
        if ($sellerName === 'Unknown Seller') {
            $sellerName = derive_username((string)($row['seller_email'] ?? '')) ?: 'Seller #' . (int)$row['seller_user_id'];
        }

        // XSS PROTECTION: Escape user-generated content before returning in JSON
        $reviews[] = [
            'rating_id'         => (int)$row['rating_id'],
            'product_id'        => (int)$row['product_id'],
            'seller_user_id'    => (int)$row['seller_user_id'],
            'seller_name'       => $sellerName, // Note: No HTML encoding needed for JSON - React handles XSS protection
            'seller_email'      => $row['seller_email'] ?? '',
            'seller_username'   => derive_username((string)($row['seller_email'] ?? '')),
            'product_title'     => $row['product_title'] ?? 'Untitled product',
            'review_text'       => $row['review_text'] ?? '',
            'rating'            => (float)$row['rating'],
            'created_at'         => $row['created_at'],
            'updated_at'         => $row['updated_at'] ?? null,
        ];
    }

    $stmt->close();
    $conn->close();

    send_json_success([
        'reviews' => $reviews,
        'count' => count($reviews)
    ]);

} catch (Throwable $e) {
    error_log('get_buyer_reviews.php error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

