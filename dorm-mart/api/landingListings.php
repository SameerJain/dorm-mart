<?php
declare(strict_types=1);

// dorm-mart/api/landingListings.php

// Include security utilities
require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    require __DIR__ . '/auth/auth_handle.php';
    require __DIR__ . '/database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = db();

    // ============================================================================
    // SQL INJECTION PROTECTION: Safe Query (No User Input)
    // ============================================================================
    // This query contains no user input - it uses only hardcoded values (0, NULL, 40).
    // There are no WHERE clause parameters from user input, so SQL injection is not possible.
    // If this query were to accept user input (e.g., filtering by search terms), we would
    // need to use prepared statements with parameter binding.
    // ============================================================================
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
          AND i.item_status = 'Active'
        ORDER BY i.date_listed DESC, i.product_id DESC
        LIMIT 40
    ";

    $res = $mysqli->query($sql);
    if ($res === false) {
        throw new Exception("SQL error: " . $mysqli->error);
    }

    $out = [];
    $now = time();

    while ($row = $res->fetch_assoc()) {
        // categories JSON -> array
        $tags = [];
        if (!empty($row['categories'])) {
            $decoded = json_decode($row['categories'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $tags = array_values(array_filter($decoded, fn($v) => is_string($v) && $v !== ''));
            }
        }

        // photos JSON -> take first AS STORED (e.g. "/data/images/img_....png")
        $image = null;
        if (!empty($row['photos'])) {
            $photos = json_decode($row['photos'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($photos) && count($photos)) {
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

        // seller name
        $seller = 'Unknown Seller';
        $first = trim((string)($row['first_name'] ?? ''));
        $last  = trim((string)($row['last_name'] ?? ''));
        if ($first !== '' || $last !== '') {
            $seller = trim($first . ' ' . $last);
        } elseif (!empty($row['email'])) {
            $seller = $row['email'];
        }

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $out[] = [
            'id'         => (int)$row['product_id'],
            'title'      => $row['title'] ?? 'Untitled',
            'price'      => $row['listing_price'] !== null ? (float)$row['listing_price'] : 0,
            'image'      => $image,      // <-- "/data/images/xxxx.png"
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

    echo json_encode($out);
    exit;

} catch (Throwable $e) {
    error_log('landingListings error: ' . $e->getMessage());
    http_response_code(500);
    // XSS PROTECTION: Escape error message to prevent XSS if it contains user input
    // SECURITY: In production, consider removing 'detail' field to prevent information disclosure
    echo json_encode([
        'ok' => false,
        'error' => 'Server error',
        'detail' => $e->getMessage(), // Note: No HTML encoding needed for JSON - React handles XSS protection
    ]);
    exit;
}
