<?php

declare(strict_types=1);

// Include security utilities
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Enforce POST method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    // Require authentication - this will redirect to login if not authenticated
    $userId = require_login();
    
    // DB connection
    $conn = db();
    $conn->set_charset('utf8mb4');

    // Check if scheduled_purchase_requests table exists
    $tableCheck = $conn->query("SHOW TABLES LIKE 'scheduled_purchase_requests'");
    $hasScheduledPurchaseTable = $tableCheck && $tableCheck->num_rows > 0;

    // Fetch seller listings from INVENTORY for current user
    // Include check for accepted scheduled purchases (if table exists)
    if ($hasScheduledPurchaseTable) {
        $sql = "SELECT 
                    i.product_id,
                    i.title,
                    i.listing_price,
                    i.item_status,
                    i.categories,
                    i.sold,
                    i.sold_to,
                    i.date_listed,
                    i.photos,
                    i.seller_id,
                    i.price_nego,
                    i.trades,
                    i.wishlisted,
                    i.item_location AS meet_location,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM scheduled_purchase_requests spr 
                            WHERE spr.inventory_product_id = i.product_id 
                            AND spr.status = 'accepted'
                        ) THEN 1 
                        ELSE 0 
                    END AS has_accepted_scheduled_purchase
                FROM INVENTORY i
                WHERE i.seller_id = ?
                ORDER BY i.product_id DESC";
    } else {
        // Fallback query without scheduled_purchase_requests check
        $sql = "SELECT 
                    i.product_id,
                    i.title,
                    i.listing_price,
                    i.item_status,
                    i.categories,
                    i.sold,
                    i.sold_to,
                    i.date_listed,
                    i.photos,
                    i.seller_id,
                    i.price_nego,
                    i.trades,
                    i.wishlisted,
                    i.item_location AS meet_location,
                    0 AS has_accepted_scheduled_purchase,
                FROM INVENTORY i
                WHERE i.seller_id = ?
                ORDER BY i.product_id DESC";
    }

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        $error = $conn->error;
        throw new RuntimeException('Failed to prepare query: ' . $error);
    }
    $stmt->bind_param('i', $userId);
    if (!$stmt->execute()) {
        $error = $stmt->error;
        throw new RuntimeException('Failed to execute query: ' . $error);
    }
    $res = $stmt->get_result();

    $data = [];
    while ($row = $res->fetch_assoc()) {
        $photosJson = $row['photos'] ?? null;
        $firstImage = null;
        if ($photosJson) {
            $decoded = json_decode($photosJson, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && !empty($decoded)) {
                $firstImage = $decoded[0] ?? null;
            }
        }

        $isSold = isset($row['sold']) ? (bool)$row['sold'] : false;
        $buyerId = $isSold ? ($row['sold_to'] ?? null) : null;
        $statusFromDb = isset($row['item_status']) && $row['item_status'] !== '' ? (string)$row['item_status'] : null;
        $status = $statusFromDb ?? ($isSold ? 'Sold' : 'Active');

        // derive categories from JSON column if present
        $catsArr = [];
        if (isset($row['categories']) && $row['categories'] !== null && $row['categories'] !== '') {
            $tmp = json_decode($row['categories'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($tmp)) {
                foreach ($tmp as $v) {
                    if (is_string($v) && $v !== '') $catsArr[] = $v;
                }
            }
        }

        $hasAcceptedScheduledPurchase = isset($row['has_accepted_scheduled_purchase']) && (int)$row['has_accepted_scheduled_purchase'] === 1;

        $priceNegotiable = isset($row['price_nego']) ? ((int)$row['price_nego'] === 1) : false;
        $acceptTrades = isset($row['trades']) ? ((int)$row['trades'] === 1) : false;
        $itemMeetLocation = isset($row['meet_location']) ? trim((string)$row['meet_location']) : null;

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $data[] = [
            'id' => (int)$row['product_id'],
            'title' => (string)$row['title'],
            'price' => isset($row['listing_price']) ? (float)$row['listing_price'] : 0.0,
            'status' => $status,
            'buyer_user_id' => $buyerId !== null ? (int)$buyerId : null,
            'seller_user_id' => (int)$row['seller_id'],
            'created_at' => $row['date_listed'],
            'image_url' => $firstImage,
            'categories' => $catsArr,
            'has_accepted_scheduled_purchase' => $hasAcceptedScheduledPurchase,
            'priceNegotiable' => $priceNegotiable,
            'acceptTrades' => $acceptTrades,
            'meet_location' => $itemMeetLocation,
            'wishlisted' => $row['wishlisted']
        ];
    }

    echo json_encode(['success' => true, 'data' => $data]);
} catch (Throwable $e) {
    // Log error server-side (in production, use proper logging)
    error_log('Seller listings error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());

    http_response_code(500);
    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    // SECURITY: In production, consider removing detailed error fields to prevent information disclosure
    $debug = true; // Temporarily enabled for debugging
    echo json_encode([
        'success' => false, 
        'error' => $e->getMessage(),
        'file' => $debug ? $e->getFile() : null,
        'line' => $debug ? $e->getLine() : null,
        'trace' => $debug ? $e->getTraceAsString() : null
    ]);
}
