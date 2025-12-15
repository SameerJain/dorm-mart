<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {

    // Fetch unread wishlist notifications for this seller
    $stmt = $conn->prepare(
        'SELECT product_id, title, image_url, unread_count 
         FROM wishlist_notification 
         WHERE seller_id = ? AND unread_count > 0'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }

    $stmt->bind_param('i', $userId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $res = $stmt->get_result();

    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    $unreads = [];
    while ($row = $res->fetch_assoc()) {
        $unreads[] = [
            'product_id'   => (int)$row['product_id'],
            'title'        => $row['title'] ?? 'Untitled',
            'image_url'    => $row['image_url'],
            'unread_count' => (int)$row['unread_count'],
        ];
    }
    $stmt->close();

    send_json_success(['unreads' => $unreads]);
} catch (Throwable $e) {
    error_log('fetch_unread_notifications error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}
