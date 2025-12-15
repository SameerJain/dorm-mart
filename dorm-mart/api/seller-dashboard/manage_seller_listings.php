<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../helpers/data_parsers.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    // Fetch seller listings from INVENTORY for current user
    // Include check for accepted scheduled purchases
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
                -- Ongoing purchases: Check if item has any accepted scheduled purchase requests
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
        // Use helpers for parsing
        $firstImage = get_first_photo($row['photos'] ?? null);
        $catsArr = parse_categories_json($row['categories'] ?? null);

        $isSold = isset($row['sold']) ? (bool)$row['sold'] : false;
        $buyerId = $isSold ? ($row['sold_to'] ?? null) : null;
        $statusFromDb = isset($row['item_status']) && $row['item_status'] !== '' ? (string)$row['item_status'] : null;
        $status = $statusFromDb ?? ($isSold ? 'Sold' : 'Active');

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

    send_json_success(['data' => $data]);
} catch (Throwable $e) {
    // Log error server-side (in production, use proper logging)
    error_log('Seller listings error: ' . $e->getMessage());
    error_log('Stack trace: ' . $e->getTraceAsString());

    // SECURITY: In production, consider removing detailed error fields to prevent information disclosure
    send_json_error(500, 'Internal server error');
}
