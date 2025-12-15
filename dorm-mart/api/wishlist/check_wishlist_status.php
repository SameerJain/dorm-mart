<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    // Validate product ID from GET parameters
    $productId = validate_product_id($_GET, 'product_id');

    $stmt = $conn->prepare('SELECT wishlist_id FROM wishlist WHERE user_id = ? AND product_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }
    $stmt->bind_param('ii', $userId, $productId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $result = $stmt->get_result();
    $isInWishlist = $result->num_rows > 0;
    $stmt->close();

    send_json_success(['in_wishlist' => $isInWishlist]);
} catch (Throwable $e) {
    error_log('check_wishlist_status error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

