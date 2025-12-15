<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

$input = get_request_data();
$prod_id = isset($input['product_id']) ? trim((string)$input['product_id']) : '';
if ($prod_id === '' || !ctype_digit($prod_id)) {
    send_json_error(400, 'Invalid or missing product_id');
}
$productId = (int)$prod_id;

$sql = "SELECT 
    product_id,
    title,
    tags,
    meet_location,
    item_condition,
    description,
    photos,
    listing_price,
    trades,
    price_nego,
    date_listed,
    seller_id,
    sold,
    final_price,
    date_sold,
    sold_to
FROM INVENTORY
WHERE product_id = ?";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    send_json_error(500, 'DB prepare failed');
}

$stmt->bind_param('i', $productId);

if (!$stmt->execute()) {
    send_json_error(500, 'DB execute failed');
}

$res = $stmt->get_result();
$row = $res->fetch_assoc();
$stmt->close();

if (!$row) {
    send_json_error(404, 'Product not found');
}

/* Decode JSON columns safely */
$row['tags']   = isset($row['tags']) && $row['tags'] !== null ? json_decode($row['tags'], true) : null;
$row['photos'] = isset($row['photos']) && $row['photos'] !== null ? json_decode($row['photos'], true) : null;

/* Normalize booleans/ints */
$row['trades']      = (int)$row['trades'];
$row['price_nego']  = (int)$row['price_nego'];
$row['sold']        = (int)$row['sold'];
$row['seller_id']   = (int)$row['seller_id'];
$row['sold_to']     = isset($row['sold_to']) ? (int)$row['sold_to'] : null;
$row['product_id']  = (int)$row['product_id'];
$row['listing_price']= $row['listing_price'] !== null ? (float)$row['listing_price'] : null;
$row['final_price']  = $row['final_price'] !== null ? (float)$row['final_price'] : null;

// Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
$productOutput = [
    'product_id' => $row['product_id'],
    'title' => $row['title'] ?? 'Untitled',
    'tags' => $row['tags'],
    'meet_location' => $row['meet_location'] ?? '',
    'item_condition' => $row['item_condition'] ?? '',
    'description' => $row['description'] ?? '',
    'photos' => $row['photos'],
    'listing_price' => $row['listing_price'],
    'trades' => $row['trades'],
    'price_nego' => $row['price_nego'],
    'date_listed' => $row['date_listed'],
    'seller_id' => $row['seller_id'],
    'sold' => $row['sold'],
    'final_price' => $row['final_price'],
    'date_sold' => $row['date_sold'] ?? null,
    'sold_to' => $row['sold_to'],
];

send_json_success(['product' => $productOutput]);
