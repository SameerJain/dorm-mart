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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    auth_boot_session();
    $userId = require_login();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    // Validate product_id
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;
    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid product_id']);
        exit;
    }

    // Validate buyer_user_id
    $buyerId = isset($payload['buyer_user_id']) ? (int)$payload['buyer_user_id'] : 0;
    if ($buyerId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid buyer_user_id']);
        exit;
    }

    // Validate rating (0-5 in 0.5 increments)
    $rating = isset($payload['rating']) ? (float)$payload['rating'] : -1;
    if ($rating < 0 || $rating > 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Rating must be between 0 and 5']);
        exit;
    }
    // Check for 0.5 increments
    if (fmod($rating * 2, 1) !== 0.0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Rating must be in 0.5 increments']);
        exit;
    }

    // Validate review_text (optional, max 250 chars if provided)
    $reviewText = isset($payload['review_text']) ? trim((string)$payload['review_text']) : '';
    if (strlen($reviewText) > 250) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Review text must be 250 characters or less']);
        exit;
    }
    
    // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
    if ($reviewText !== '' && containsXSSPattern($reviewText)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in review text']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

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
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Product not found']);
        exit;
    }

    $sellerId = (int)$productRow['seller_id'];

    // Verify that the current user is the seller
    if ($sellerId !== $userId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You can only rate buyers for your own products']);
        exit;
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
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Product must be sold to this buyer']);
        exit;
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
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'You have already rated this buyer for this product']);
        exit;
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
    $conn->close();

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    echo json_encode([
        'success' => true,
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
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

