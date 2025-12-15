<?php
// api/list-user-conversations.php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

$sql = "
  SELECT
    c.conv_id,
    c.user1_id,
    c.user2_id,
    c.user1_fname,
    c.user2_fname,
    c.product_id,
    c.item_deleted,
    inv.title AS product_title,
    inv.seller_id AS product_seller_id,
    inv.photos AS product_photos
  FROM conversations c
  LEFT JOIN INVENTORY inv ON inv.product_id = c.product_id
  WHERE (c.user1_id = ? AND c.user1_deleted = 0)
     OR (c.user2_id = ? AND c.user2_deleted = 0)
  ORDER BY c.created_at DESC
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
  // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
  send_json_error(500, 'Prepare failed', ['detail' => $conn->error]);
}

$stmt->bind_param('ii', $userId, $userId); // 'ii' = two integers
$stmt->execute();

$res = $stmt->get_result();          // requires mysqlnd (present in XAMPP)
$rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];

// Extract first image from photos JSON for each conversation
// XSS PROTECTION: Escape user-generated content before returning in JSON
foreach ($rows as &$row) {
    $productImageUrl = null;
    if (!empty($row['product_photos'])) {
        $photosJson = $row['product_photos'];
        $decoded = json_decode($photosJson, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && !empty($decoded)) {
            $productImageUrl = $decoded[0] ?? null;
        }
    }
    $row['product_image_url'] = $productImageUrl;
    unset($row['product_photos']); // Remove raw photos JSON from response
    
    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    $row['user1_fname'] = $row['user1_fname'] ?? '';
    $row['user2_fname'] = $row['user2_fname'] ?? '';
    $row['product_title'] = $row['product_title'] ?? '';
}

send_json_success(['conversations' => $rows]);
