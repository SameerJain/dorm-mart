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
        echo json_encode(['success' => false, 'error' => 'You are not authorized to view buyer ratings for this product']);
        exit;
    }

    // Get the buyer rating for this product
    $stmt = $conn->prepare(
        'SELECT rating_id, product_id, seller_user_id, buyer_user_id, rating, review_text, created_at, updated_at
         FROM buyer_ratings 
         WHERE seller_user_id = ? AND product_id = ?
         LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare buyer rating lookup');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $rating = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    $conn->close();

    if (!$rating) {
        echo json_encode([
            'success' => true,
            'has_rating' => false,
            'rating' => null
        ]);
        exit;
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $ratingData = [
        'rating_id' => (int)$rating['rating_id'],
        'product_id' => (int)$rating['product_id'],
        'seller_user_id' => (int)$rating['seller_user_id'],
        'buyer_user_id' => (int)$rating['buyer_user_id'],
        'rating' => (float)$rating['rating'],
        'review_text' => escapeHtml($rating['review_text'] ?? ''),
        'created_at' => $rating['created_at'],
        'updated_at' => $rating['updated_at']
    ];

    echo json_encode([
        'success' => true,
        'has_rating' => true,
        'rating' => $ratingData
    ]);

} catch (Throwable $e) {
    error_log('get_buyer_rating.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

