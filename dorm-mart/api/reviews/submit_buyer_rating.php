<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../security/security.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    // Validate product_id
    $productId = validate_product_id($payload);

    // Validate buyer_user_id
    $buyerId = isset($payload['buyer_user_id']) ? (int)$payload['buyer_user_id'] : 0;
    if ($buyerId <= 0) {
        send_json_error(400, 'Invalid buyer_user_id');
    }

    // Validate rating (0-5 in 0.5 increments)
    $rating = validate_rating($payload, 'rating', 0, 5, true);

    // Validate review_text (optional, max 250 chars if provided)
    $reviewText = isset($payload['review_text']) ? trim((string)$payload['review_text']) : '';
    if (strlen($reviewText) > 250) {
        send_json_error(400, 'Review text must be 250 characters or less');
    }
    
    // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
    if ($reviewText !== '' && containsXSSPattern($reviewText)) {
        send_json_error(400, 'Invalid characters in review text');
    }

    // Check if the product exists and get seller_id
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

    // Verify that the current user is the seller
    if ($sellerId !== $userId) {
        send_json_error(403, 'You can only rate buyers for your own products');
    }

    // Verify that the product is sold to this buyer
    $stmt = $conn->prepare('SELECT sold, sold_to, item_status FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare sold status lookup');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $soldRow = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    $isSold = ($soldRow && ($soldRow['sold'] == 1 || strtolower($soldRow['item_status'] ?? '') === 'sold'));
    $soldToBuyer = $soldRow && isset($soldRow['sold_to']) && (int)$soldRow['sold_to'] === $buyerId;

    if (!$isSold || !$soldToBuyer) {
        send_json_error(403, 'Product must be sold to this buyer');
    }

    // Check if user has already rated this buyer for this product
    $stmt = $conn->prepare('SELECT rating_id FROM buyer_ratings WHERE seller_user_id = ? AND buyer_user_id = ? AND product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare existing rating check');
    }
    $stmt->bind_param('iii', $userId, $buyerId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $existingRating = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if ($existingRating) {
        send_json_error(409, 'You have already rated this buyer for this product');
    }

    // Insert the buyer rating
    $stmt = $conn->prepare(
        'INSERT INTO buyer_ratings (product_id, seller_user_id, buyer_user_id, rating, review_text) 
         VALUES (?, ?, ?, ?, ?)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare buyer rating insert');
    }
    $stmt->bind_param('iiids', $productId, $userId, $buyerId, $rating, $reviewText);
    $success = $stmt->execute();
    $ratingId = $stmt->insert_id;
    $stmt->close();

    if (!$success) {
        throw new RuntimeException('Failed to insert buyer rating');
    }

    // Update buyer's average buyer_rating in user_accounts
    $stmt = $conn->prepare(
        'UPDATE user_accounts SET buyer_rating = (
            SELECT AVG(rating) FROM buyer_ratings WHERE buyer_user_id = ?
        ) WHERE user_id = ?'
    );
    if ($stmt) {
        $stmt->bind_param('ii', $buyerId, $buyerId);
        $stmt->execute();
        $stmt->close();
    }

    // Get the created rating
    $stmt = $conn->prepare(
        'SELECT rating_id, product_id, seller_user_id, buyer_user_id, rating, review_text, created_at, updated_at
         FROM buyer_ratings WHERE rating_id = ? LIMIT 1'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare rating fetch');
    }
    $stmt->bind_param('i', $ratingId);
    $stmt->execute();
    $result = $stmt->get_result();
    $ratingData = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    send_json_success([
        'rating_id' => $ratingId,
        'rating' => [
            'rating_id' => (int)$ratingData['rating_id'],
            'product_id' => (int)$ratingData['product_id'],
            'seller_user_id' => (int)$ratingData['seller_user_id'],
            'buyer_user_id' => (int)$ratingData['buyer_user_id'],
            'rating' => (float)$ratingData['rating'],
            'review_text' => $ratingData['review_text'] ?? '', // Note: No HTML encoding needed for JSON - React handles XSS protection
            'created_at' => $ratingData['created_at'],
            'updated_at' => $ratingData['updated_at'],
        ],
        'message' => 'Buyer rating submitted successfully'
    ]);

} catch (Throwable $e) {
    error_log('submit_buyer_rating.php error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

