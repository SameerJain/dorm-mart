<?php
declare(strict_types=1);

// dorm-mart/api/viewProduct.php
// Returns a single product by product_id

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../helpers/data_parsers.php';
require_once __DIR__ . '/../profile/profile_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$mysqli = $result['conn'];

try {
    // Accept product_id from query (supports `id` or `product_id`)
    $prodStr = isset($_GET['product_id']) ? (string)$_GET['product_id'] : (isset($_GET['id']) ? (string)$_GET['id'] : '');
    $prodStr = trim($prodStr);
    if ($prodStr === '' || !ctype_digit($prodStr)) {
        send_json_error(400, 'Invalid or missing product_id');
    }
    $productId = (int)$prodStr;

    $sql = "
        SELECT 
            i.product_id,
            i.title,
            i.categories,
            i.item_location,
            i.item_condition,
            i.description,
            i.photos,
            i.listing_price,
            i.trades,
            i.price_nego,
            i.date_listed,
            i.seller_id,
            i.sold,
            i.final_price,
            i.date_sold,
            i.sold_to,
            ua.first_name,
            ua.last_name,
            ua.email
        FROM INVENTORY AS i
        LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id
        WHERE i.product_id = ?
        LIMIT 1
    ";

    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        throw new Exception('DB prepare failed: ' . $mysqli->error);
    }
    $stmt->bind_param('i', $productId);  // 'i' = integer type, safely bound as parameter
    if (!$stmt->execute()) {
        $err = $stmt->error;
        $stmt->close();
        throw new Exception('DB execute failed: ' . $err);
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        send_json_error(404, 'Product not found');
    }

    // Use helpers for parsing
    $tags = parse_categories_json($row['categories'] ?? null);
    $photos = parse_photos_json($row['photos'] ?? null);
    $seller = build_seller_name($row);

    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    $out = [
        // core
        'product_id'    => (int)$row['product_id'],
        'title'         => $row['title'] ?? 'Untitled',
        'description'   => $row['description'] ?? '',
        'listing_price' => $row['listing_price'] !== null ? (float)$row['listing_price'] : null,

        // normalized fields expected by frontend
        'tags'          => $tags,                 // derived from categories
        'categories'    => $row['categories'] ?? null, // raw JSON string for compatibility
        'item_location' => $row['item_location'] ?? '',
        'item_condition'=> $row['item_condition'] ?? '',
        'photos'        => $photos,               // array of paths/urls
        'trades'        => (bool)$row['trades'],
        'price_nego'    => (bool)$row['price_nego'],
        'date_listed'   => $row['date_listed'] ?? null,
        'seller_id'     => isset($row['seller_id']) ? (int)$row['seller_id'] : null,
        'sold'          => (bool)$row['sold'],
        'final_price'   => $row['final_price'] !== null ? (float)$row['final_price'] : null,
        'date_sold'     => $row['date_sold'] ?? null,
        'sold_to'       => isset($row['sold_to']) ? (int)$row['sold_to'] : null,

        // seller display helpers
        'seller'        => $seller,
        'email'         => $row['email'] ?? '',

        // convenience timestamp-like field
        'created_at'    => !empty($row['date_listed']) ? ($row['date_listed'] . ' 00:00:00') : null,
    ];

    send_json_success($out);

} catch (Throwable $e) {
    error_log('viewProduct error: ' . $e->getMessage());
    // SECURITY: In production, consider removing 'detail' field to prevent information disclosure
    send_json_error(500, 'Server error', ['detail' => $e->getMessage()]);
}
