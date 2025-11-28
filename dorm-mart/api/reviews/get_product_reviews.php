<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

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

    // Validate product_id
    $productIdParam = trim((string)($_GET['product_id'] ?? ''));
    if (!ctype_digit($productIdParam)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid product_id']);
        exit;
    }
    $productId = (int)$productIdParam;

    $conn = db();
    $conn->set_charset('utf8mb4');

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
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Product not found']);
        exit;
    }

    $sellerId = (int)$productRow['seller_id'];
    if ($sellerId !== $userId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You are not authorized to view reviews for this product']);
        exit;
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
        $buyerName = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ($buyerName === '') {
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
            'review_text' => escapeHtml($row['review_text']),
            'image1_url' => $row['image1_url'] ?? null,
            'image2_url' => $row['image2_url'] ?? null,
            'image3_url' => $row['image3_url'] ?? null,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
            'buyer_name' => escapeHtml($buyerName),
            'buyer_email' => escapeHtml($row['email'] ?? '')
        ];
    }
    
    $stmt->close();
    $conn->close();

    echo json_encode([
        'success' => true,
        'count' => count($reviews),
        'reviews' => $reviews
    ]);

} catch (Throwable $e) {
    error_log('get_product_reviews.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

