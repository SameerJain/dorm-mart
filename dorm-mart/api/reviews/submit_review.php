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

    // Validate rating (seller rating, 0-5 in 0.5 increments)
    $rating = isset($payload['rating']) ? (float)$payload['rating'] : -1;
    if ($rating < 0 || $rating > 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Seller rating must be between 0 and 5']);
        exit;
    }
    // Check for 0.5 increments
    if (fmod($rating * 2, 1) !== 0.0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Seller rating must be in 0.5 increments']);
        exit;
    }

    // Validate product_rating (0-5 in 0.5 increments)
    $productRating = isset($payload['product_rating']) ? (float)$payload['product_rating'] : -1;
    if ($productRating < 0 || $productRating > 5) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product rating must be between 0 and 5']);
        exit;
    }
    // Check for 0.5 increments
    if (fmod($productRating * 2, 1) !== 0.0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product rating must be in 0.5 increments']);
        exit;
    }

    // Validate review_text (1-1000 chars, required)
    $reviewText = isset($payload['review_text']) ? trim((string)$payload['review_text']) : '';
    if ($reviewText === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Review text is required']);
        exit;
    }
    if (mb_strlen($reviewText) > 1000) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Review text must be 1000 characters or less']);
        exit;
    }

    // Validate optional image URLs (up to 3 images)
    $image1Url = isset($payload['image1_url']) ? trim((string)$payload['image1_url']) : null;
    $image2Url = isset($payload['image2_url']) ? trim((string)$payload['image2_url']) : null;
    $image3Url = isset($payload['image3_url']) ? trim((string)$payload['image3_url']) : null;
    
    // Ensure images are from our upload directory (security check)
    $validateImageUrl = function($url) {
        if ($url === null || $url === '') return null;
        if (!str_starts_with($url, '/media/review-images/')) {
            return null; // reject invalid paths
        }
        return $url;
    };
    
    $image1Url = $validateImageUrl($image1Url);
    $image2Url = $validateImageUrl($image2Url);
    $image3Url = $validateImageUrl($image3Url);

    // XSS protection for review text
    if (containsXSSPattern($reviewText)) {
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

    // Prevent sellers from reviewing their own products
    if ($sellerId === $userId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You cannot review your own product']);
        exit;
    }

    // Check if user has purchased this product
    $hasPurchased = false;

    // Check purchase_history table (JSON array format)
    $stmt = $conn->prepare('SELECT items FROM purchase_history WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare purchase history lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $historyRow = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if ($historyRow && !empty($historyRow['items'])) {
        $items = json_decode((string)$historyRow['items'], true);
        if (is_array($items)) {
            foreach ($items as $item) {
                if (is_array($item) && isset($item['product_id']) && (int)$item['product_id'] === $productId) {
                    $hasPurchased = true;
                    break;
                }
            }
        }
    }

    // If not found in purchase_history, check legacy purchased_items table
    if (!$hasPurchased) {
        $stmt = $conn->prepare('SELECT COUNT(*) as count FROM purchased_items WHERE buyer_user_id = ? AND item_id = ? LIMIT 1');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare purchased items lookup');
        }
        $stmt->bind_param('ii', $userId, $productId);
        $stmt->execute();
        $result = $stmt->get_result();
        $countRow = $result ? $result->fetch_assoc() : null;
        $stmt->close();

        if ($countRow && (int)$countRow['count'] > 0) {
            $hasPurchased = true;
        }
    }

    if (!$hasPurchased) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You can only review products you have purchased']);
        exit;
    }

    // Check if user has already reviewed this product
    $stmt = $conn->prepare('SELECT review_id FROM product_reviews WHERE buyer_user_id = ? AND product_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare existing review check');
    }
    $stmt->bind_param('ii', $userId, $productId);
    $stmt->execute();
    $result = $stmt->get_result();
    $existingReview = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if ($existingReview) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'You have already reviewed this product']);
        exit;
    }

    // Insert the review with optional images
    $stmt = $conn->prepare(
        'INSERT INTO product_reviews (product_id, buyer_user_id, seller_user_id, rating, product_rating, review_text, image1_url, image2_url, image3_url) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare review insert');
    }
    $stmt->bind_param('iiiddssss', $productId, $userId, $sellerId, $rating, $productRating, $reviewText, $image1Url, $image2Url, $image3Url);
    $success = $stmt->execute();
    $reviewId = $stmt->insert_id;
    $stmt->close();

    if (!$success) {
        throw new RuntimeException('Failed to insert review');
    }

    // Update seller's average seller_rating in user_accounts
    $stmt = $conn->prepare(
        'UPDATE user_accounts SET seller_rating = (
            SELECT AVG(rating) FROM product_reviews WHERE seller_user_id = ?
        ) WHERE user_id = ?'
    );
    if ($stmt) {
        $stmt->bind_param('ii', $sellerId, $sellerId);
        $stmt->execute();
        $stmt->close();
    }

    $conn->close();

    echo json_encode([
        'success' => true,
        'review_id' => $reviewId,
        'message' => 'Review submitted successfully'
    ]);

} catch (Throwable $e) {
    error_log('submit_review.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

