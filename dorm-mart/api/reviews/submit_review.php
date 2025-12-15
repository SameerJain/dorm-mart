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

    // Validate rating (seller rating, 0-5 in 0.5 increments)
    $rating = validate_rating($payload, 'rating', 0, 5, true);

    // Validate product_rating (0-5 in 0.5 increments)
    $productRating = validate_rating($payload, 'product_rating', 0, 5, true);

    // Validate review_text (1-1000 chars, required)
    $reviewText = isset($payload['review_text']) ? trim((string)$payload['review_text']) : '';
    if ($reviewText === '') {
        send_json_error(400, 'Review text is required');
    }
    if (mb_strlen($reviewText) > 1000) {
        send_json_error(400, 'Review text must be 1000 characters or less');
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

    // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
    if (containsXSSPattern($reviewText)) {
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

    // Prevent sellers from reviewing their own products
    if ($sellerId === $userId) {
        send_json_error(403, 'You cannot review your own product');
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
        send_json_error(403, 'You can only review products you have purchased');
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
        send_json_error(409, 'You have already reviewed this product');
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
    // Check if seller_rating column exists before updating (graceful degradation)
    try {
        $checkColumn = $conn->query("SHOW COLUMNS FROM user_accounts LIKE 'seller_rating'");
        if ($checkColumn && $checkColumn->num_rows > 0) {
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
        }
    } catch (Throwable $updateError) {
        // Silently ignore seller_rating update failures to not break review submission
    }

    send_json_success([
        'review_id' => $reviewId,
        'message' => 'Review submitted successfully'
    ]);

} catch (Throwable $e) {
    error_log('submit_review.php error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

