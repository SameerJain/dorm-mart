<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../helpers/data_parsers.php';
require_once __DIR__ . '/../profile/profile_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $sql = "SELECT 
                w.wishlist_id,
                w.product_id,
                w.created_at,
                i.title,
                i.listing_price,
                i.item_status,
                i.categories,
                i.photos,
                i.seller_id,
                i.item_location,
                i.item_condition,
                i.description,
                i.trades,
                i.price_nego,
                i.date_listed,
                ua.first_name,
                ua.last_name,
                ua.email
            FROM wishlist w
            INNER JOIN INVENTORY i ON w.product_id = i.product_id
            LEFT JOIN user_accounts ua ON i.seller_id = ua.user_id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }
    $stmt->bind_param('i', $userId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $result = $stmt->get_result();

    $items = [];
    while ($row = $result->fetch_assoc()) {
        // Parse categories and photos using helpers
        $categories = parse_categories_json($row['categories'] ?? null);
        $imageUrl = get_first_photo($row['photos'] ?? null);
        $sellerName = build_seller_name($row);

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $items[] = [
            'wishlist_id' => (int)$row['wishlist_id'],
            'product_id' => (int)$row['product_id'],
            'title' => (string)$row['title'],
            'price' => isset($row['listing_price']) ? (float)$row['listing_price'] : 0.0,
            'image_url' => $imageUrl,
            'categories' => $categories,
            'tags' => $categories, // For compatibility with ItemCardNew
            'seller' => $sellerName,
            'seller_id' => (int)$row['seller_id'],
            'item_location' => $row['item_location'] ?? '',
            'item_condition' => $row['item_condition'] ?? '', // Note: No HTML encoding needed for JSON - React handles XSS protection
            'status' => $row['item_status'] ?? 'Active',
            'created_at' => $row['created_at'],
            'date_listed' => $row['date_listed'],
        ];
    }
    $stmt->close();

    send_json_success($items);
} catch (Throwable $e) {
    error_log('get_wishlist error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

