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

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // User ID and product ID are bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // This prevents SQL injection attacks even if malicious values are provided.
    // ============================================================================
    $stmt = $conn->prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare delete');
    }
    $stmt->bind_param('ii', $userId, $productId);  // 'i' = integer type, safely bound as parameters
    $stmt->execute();

    if ($stmt->affected_rows < 1) {
        // Not found in wishlist
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Product not in wishlist']);
        exit;
    }
    $stmt->close();

    /** Decrement wishlisted count for this product (floor at 0) */
    $updateStmt = $conn->prepare('UPDATE INVENTORY SET wishlisted = GREATEST(wishlisted - 1, 0) WHERE product_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('i', $productId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    // Decrement unread_count for this product (floor at 0)
    $notifStmt = $conn->prepare(
        'UPDATE wishlist_notification
        SET unread_count = CASE
            WHEN unread_count > 0 THEN unread_count - 1
            ELSE 0
        END
        WHERE product_id = ?'
    );
    if ($notifStmt) {
        $notifStmt->bind_param('i', $productId); // bind product id as integer
        $notifStmt->execute();
        $notifStmt->close();
    }

    echo json_encode(['success' => true, 'product_id' => $productId]);
} catch (Throwable $e) {
    error_log('remove_from_wishlist error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

