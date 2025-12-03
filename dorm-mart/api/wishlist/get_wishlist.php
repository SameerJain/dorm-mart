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

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // User ID is bound as parameter using bind_param().
    // The '?' placeholder ensures user input is treated as data, not executable SQL.
    // This prevents SQL injection attacks even if malicious values are provided.
    // ============================================================================
    $sql = "SELECT 
                w.wishlist_id,
                w.product_id,
                w.created_at,
                i.title,
                i.listing_price,
                i.item_status,
                i.categories,
                i.photos,
                i.seller_id,
                i.item_location,
                i.item_condition,
                i.description,
                i.trades,
                i.price_nego,
                i.date_listed,
                ua.first_name,
                ua.last_name,
                ua.email
            FROM wishlist w
            INNER JOIN INVENTORY i ON w.product_id = i.product_id
            LEFT JOIN user_accounts ua ON i.seller_id = ua.user_id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC";
    
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $items = [];
    while ($row = $result->fetch_assoc()) {
        // Parse categories JSON
        $categories = [];
        if (!empty($row['categories'])) {
            $decoded = json_decode($row['categories'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $categories = array_values(array_filter($decoded, fn($v) => is_string($v) && $v !== ''));
            }
        }

        // Parse photos JSON
        $photos = [];
        if (!empty($row['photos'])) {
            $decodedPhotos = json_decode($row['photos'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedPhotos)) {
                $photos = $decodedPhotos;
            }
        }

        // Get first image URL
        $imageUrl = null;
        if (!empty($photos) && is_array($photos)) {
            $imageUrl = $photos[0] ?? null;
        }

        // Build seller name
        $sellerName = 'Unknown Seller';
        $firstName = trim((string)($row['first_name'] ?? ''));
        $lastName = trim((string)($row['last_name'] ?? ''));
        if ($firstName !== '' || $lastName !== '') {
            $sellerName = trim($firstName . ' ' . $lastName);
        } elseif (!empty($row['email'])) {
            $sellerName = (string)$row['email'];
        }

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $items[] = [
            'wishlist_id' => (int)$row['wishlist_id'],
            'product_id' => (int)$row['product_id'],
            'title' => (string)$row['title'],
            'price' => isset($row['listing_price']) ? (float)$row['listing_price'] : 0.0,
            'image_url' => $imageUrl,
            'categories' => $categories,
            'tags' => $categories, // For compatibility with ItemCardNew
            'seller' => $sellerName,
            'seller_id' => (int)$row['seller_id'],
            'item_location' => $row['item_location'] ?? '',
            'item_condition' => $row['item_condition'] ?? '', // Note: No HTML encoding needed for JSON - React handles XSS protection
            'status' => $row['item_status'] ?? 'Active',
            'created_at' => $row['created_at'],
            'date_listed' => $row['date_listed'],
        ];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $items]);
} catch (Throwable $e) {
    error_log('get_wishlist error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

