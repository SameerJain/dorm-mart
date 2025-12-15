<?php
declare(strict_types=1);

// dorm-mart/api/landingListings.php

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../helpers/data_parsers.php';
require_once __DIR__ . '/../helpers/image_helpers.php';
require_once __DIR__ . '/../profile/profile_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$mysqli = $result['conn'];

try {
    // Check if item_status column exists
    $checkColumn = $mysqli->query("SHOW COLUMNS FROM INVENTORY LIKE 'item_status'");
    $hasItemStatus = $checkColumn && $checkColumn->num_rows > 0;
    
    // Build SQL query - handle case where item_status column might not exist
    if ($hasItemStatus) {
        // Column exists - filter by item_status
        $sql = "
            SELECT 
                i.product_id,
                i.title,
                i.categories,
                i.item_location,
                i.item_condition,
                i.photos,
                i.listing_price,
                i.trades,
                i.price_nego,
                i.date_listed,
                i.seller_id,
                i.sold,
                ua.first_name,
                ua.last_name,
                ua.email
            FROM INVENTORY AS i
            LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id
            WHERE (i.sold = 0 OR i.sold IS NULL)
              AND (i.item_status = 'Active' OR i.item_status IS NULL OR i.item_status = '')
            ORDER BY i.date_listed DESC, i.product_id DESC
            LIMIT 40
        ";
    } else {
        // Column doesn't exist - just filter by sold status
        $sql = "
            SELECT 
                i.product_id,
                i.title,
                i.categories,
                i.item_location,
                i.item_condition,
                i.photos,
                i.listing_price,
                i.trades,
                i.price_nego,
                i.date_listed,
                i.seller_id,
                i.sold,
                ua.first_name,
                ua.last_name,
                ua.email
            FROM INVENTORY AS i
            LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id
            WHERE (i.sold = 0 OR i.sold IS NULL)
            ORDER BY i.date_listed DESC, i.product_id DESC
            LIMIT 40
        ";
    }

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        throw new Exception("SQL error: " . $mysqli->error);
    }
    if (!$stmt->execute()) {
        throw new Exception("SQL execute error: " . $stmt->error);
    }
    $res = $stmt->get_result();

    $out = [];
    $now = time();

    while ($row = $res->fetch_assoc()) {
        // Parse categories using helper
        $tags = parse_categories_json($row['categories'] ?? null);

        // photos JSON -> take first AS STORED (e.g. "/images/img_....png")
        // Note: Special handling for array format with 'url' key
        $image = null;
        if (!empty($row['photos'])) {
            $photos = parse_photos_json($row['photos']);
            if (!empty($photos) && is_array($photos)) {
                $first = $photos[0];
                if (is_string($first)) {
                    $image = $first;
                } elseif (is_array($first) && isset($first['url'])) {
                    $image = $first['url'];
                }
            }
        }

        // status from date_listed
        $status = 'AVAILABLE';
        $createdAt = null;
        if (!empty($row['date_listed'])) {
            $createdAt = $row['date_listed'] . ' 00:00:00';
            $ts = strtotime($row['date_listed']);
            if ($ts !== false) {
                $diffHrs = ($now - $ts) / 3600;
                if ($diffHrs < 48) {
                    $status = 'JUST POSTED';
                }
            }
        }

        // seller name using helper
        $seller = build_seller_name($row);

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $out[] = [
            'id'         => (int)$row['product_id'],
            'title'      => $row['title'] ?? 'Untitled',
            'price'      => $row['listing_price'] !== null ? (float)$row['listing_price'] : 0,
            'image'      => $image,      // <-- "/images/xxxx.png"
            'image_url'  => $image,
            'tags'       => $tags,
            'category'   => !empty($tags) ? $tags[0] : null,
            'location'   => $row['item_location'] ?? 'North Campus',
            'condition'  => $row['item_condition'] ?? '',
            'created_at' => $createdAt,
            'seller'     => $seller,
            'sold_by'    => $seller,
            'rating'     => 4.7,
            'status'     => $status,
            'trades'     => (bool)$row['trades'],
            'price_nego' => (bool)$row['price_nego'],
        ];
    }
    
    $stmt->close();

    
    // Always prepend the Taco listing as the first item in the response
    $tacoItem = [
        'id'         => 3,
        'title'      => 'Taco',
        'price'      => 14.99,
        'image'      => '/images/img_69049790323853.16461582.jpg',
        'image_url'  => '/images/img_69049790323853.16461582.jpg',
        'tags'       => ['Kitchen', 'Food'],
        'category'   => 'Kitchen',
        'location'   => 'North Campus',
        'condition'  => 'Like New',
        'created_at' => '2025-10-31 00:00:00',
        'seller'     => 'Dorm Mart',
        'sold_by'    => 'Dorm Mart',
        'rating'     => 4.7,
        'status'     => 'AVAILABLE',
        'trades'     => true,
        'price_nego' => false,
    ];

    // Remove any DB item with the same ID to avoid duplicates, then prepend Taco
    $out = array_values(array_filter($out, fn($item) => (int)$item['id'] !== 3));
    array_unshift($out, $tacoItem);

    send_json_success($out);

} catch (Throwable $e) {
    error_log('landingListings error: ' . $e->getMessage());
    // SECURITY: In production, consider removing 'detail' field to prevent information disclosure
    send_json_error(500, 'Server error', ['detail' => $e->getMessage()]);
}
