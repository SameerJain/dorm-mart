<?php
// api/list-user-conversations.php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../security/security.php';
require __DIR__ . '/../database/db_connect.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$conn = db();

/*
login.php
- creates a new session file and updates the cookie
- PHP sends Set-Cookie
- Subsequent API calls send the cookie automatically
session_start();
if ($okPassword) {
  session_regenerate_id(true); // prevent fixation; gives a fresh session id
  $_SESSION['user_id'] = $user['user_id'];
  echo json_encode(['success' => true]);
}
*/
// reads PHPSESSID from Cookie header and loads that session
session_start(); 
$userId = (int)($_SESSION['user_id'] ?? 0);

if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

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
  http_response_code(500);
  echo json_encode(['success' => false, 'error' => 'Prepare failed', 'detail' => $db->error]);
  exit;
}

$stmt->bind_param('ii', $userId, $userId); // 'ii' = two integers
$stmt->execute();

$res = $stmt->get_result();          // requires mysqlnd (present in XAMPP)
$rows = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];

// Extract first image from photos JSON for each conversation
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
}

echo json_encode(['success' => true, 'conversations' => $rows]);
