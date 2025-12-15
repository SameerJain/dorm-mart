<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

$input = get_request_data();
$year = isset($input['year']) ? (int)$input['year'] : null;

if ($year === null || $year < 2016 || $year > 2025) {
    send_json_error(400, 'Invalid or missing year');
}

$start = sprintf('%04d-01-01 00:00:00', $year);       // start of the year (inclusive)
$end   = sprintf('%04d-01-01 00:00:00', $year + 1);   // start of next year (exclusive)

$sql = "SELECT item_id, title, sold_by, transacted_at, image_url
        FROM purchased_items
        WHERE transacted_at >= ? AND transacted_at < ?
        ORDER BY transacted_at DESC";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    send_json_error(500, 'Failed to prepare query');
}

$stmt->bind_param('ss', $start, $end);
if (!$stmt->execute()) {
    $stmt->close();
    send_json_error(500, 'Failed to execute query');
}
$res = $stmt->get_result();

$rows = [];
while ($row = $res->fetch_assoc()) {
    $rows[] = [
        'item_id' => (int)$row['item_id'],
        'title' => $row['title'],
        'sold_by' => $row['sold_by'],
        'transacted_at' => $row['transacted_at'],
        'image_url' => $row['image_url'] ?? ''
    ];
}

$stmt->close();

send_json_success(['data' => $rows]);
