<?php
declare(strict_types=1);

// JSON response
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Enforce GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

require __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

try {
    $userId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

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
    $stmt->execute();
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

    echo json_encode(['success' => true, 'unreads' => $unreads]);
} catch (Throwable $e) {
    error_log('fetch_unread_notifications error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
