<?php
declare(strict_types=1);

// JSON response
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();
    
    $conn = db();
    $conn->set_charset('utf8mb4');

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!is_array($input)) $input = [];
    
    /* Conditional CSRF validation - only validate if token is provided */
    $token = $input['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'CSRF token validation failed']);
        exit;
    }
    
    $productId = isset($input['product_id']) ? (int)$input['product_id'] : 0;
    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid product_id']);
        exit;
    }

    // Verify product exists
    $checkStmt = $conn->prepare('SELECT product_id FROM INVENTORY WHERE product_id = ?');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare product check');
    }
    $checkStmt->bind_param('i', $productId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Product not found']);
        exit;
    }
    $checkStmt->close();

    // Check if already in wishlist
    $checkWishlistStmt = $conn->prepare('SELECT wishlist_id FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$checkWishlistStmt) {
        throw new RuntimeException('Failed to prepare wishlist check');
    }
    $checkWishlistStmt->bind_param('ii', $userId, $productId);
    $checkWishlistStmt->execute();
    $wishlistResult = $checkWishlistStmt->get_result();
    if ($wishlistResult->num_rows > 0) {
        // Already in wishlist
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product already in wishlist']);
        exit;
    }
    $checkWishlistStmt->close();

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // User ID and product ID are bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // This prevents SQL injection attacks even if malicious values are provided.
    // ============================================================================
    $stmt = $conn->prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare insert');
    }
    $stmt->bind_param('ii', $userId, $productId);  // 'i' = integer type, safely bound as parameters
    $stmt->execute();
    $wishlistId = $conn->insert_id;
    $stmt->close();

    /** increment wishlisted count for this product */
    $updateStmt = $conn->prepare('UPDATE INVENTORY SET wishlisted = wishlisted + 1 WHERE product_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('i', $productId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    // increment unread_count for this product in wishlist_notification
    $wnStmt = $conn->prepare('UPDATE wishlist_notification SET unread_count = unread_count + 1 WHERE product_id = ?');
    if ($wnStmt) {
        $wnStmt->bind_param('i', $productId);
        $wnStmt->execute();
        $wnStmt->close();
    }

    echo json_encode(['success' => true, 'wishlist_id' => $wishlistId, 'product_id' => $productId]);
} catch (Throwable $e) {
    error_log('add_to_wishlist error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

