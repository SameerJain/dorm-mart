<?php
// Include security utilities
require_once __DIR__ . '/../../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// __DIR__ points to api/
require __DIR__ . '/../../database/db_connect.php';

$conn = db();

$sql = "SELECT *
        FROM purchased_items
        ORDER BY transacted_at DESC
        LIMIT 1
";

$res = $conn->query($sql);

// XSS PROTECTION: Escape user-generated content before returning in JSON
$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = [
        'item_id' => isset($row['item_id']) ? (int)$row['item_id'] : null,
        'title' => escapeHtml($row['title'] ?? ''),
        'sold_by' => escapeHtml($row['sold_by'] ?? ''),
        'transacted_at' => $row['transacted_at'] ?? null,
        'image_url' => escapeHtml($row['image_url'] ?? ''),
        'buyer_user_id' => isset($row['buyer_user_id']) ? (int)$row['buyer_user_id'] : null,
    ];
}

echo json_encode(['success' => true, 'data' => $rows]);
