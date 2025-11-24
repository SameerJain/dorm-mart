<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../profile/profile_helpers.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    auth_boot_session();
    $userId = require_login();

    // Always use logged-in user's ID for privacy - users can only view their own buyer reviews
    $buyerId = $userId;

    $conn = db();
    $conn->set_charset('utf8mb4');

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
        $sellerName = trim(trim((string)$row['seller_first']) . ' ' . trim((string)$row['seller_last']));
        if ($sellerName === '') {
            $sellerName = derive_username((string)($row['seller_email'] ?? '')) ?: 'Seller #' . (int)$row['seller_user_id'];
        }

        $reviews[] = [
            'rating_id'         => (int)$row['rating_id'],
            'product_id'        => (int)$row['product_id'],
            'seller_user_id'    => (int)$row['seller_user_id'],
            'seller_name'       => $sellerName,
            'seller_email'      => $row['seller_email'] ?? null,
            'seller_username'   => derive_username((string)($row['seller_email'] ?? '')),
            'product_title'     => escapeHtml($row['product_title'] ?? 'Untitled product'),
            'review_text'       => escapeHtml($row['review_text'] ?? ''),
            'rating'            => (float)$row['rating'],
            'created_at'         => $row['created_at'],
            'updated_at'         => $row['updated_at'] ?? null,
        ];
    }

    $stmt->close();
    $conn->close();

    echo json_encode([
        'success' => true,
        'reviews' => $reviews,
        'count' => count($reviews)
    ]);

} catch (Throwable $e) {
    error_log('get_buyer_reviews.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

