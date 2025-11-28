<?php
declare(strict_types=1);

// dorm-mart/api/viewProduct.php
// Returns a single product by product_id

require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']); exit; }

try {
    require __DIR__ . '/auth/auth_handle.php';
    require __DIR__ . '/database/db_connect.php';

    auth_boot_session();
    $userId = require_login();

    // Accept product_id from query (supports `id` or `product_id`)
    $prodStr = isset($_GET['product_id']) ? (string)$_GET['product_id'] : (isset($_GET['id']) ? (string)$_GET['id'] : '');
    $prodStr = trim($prodStr);
    if ($prodStr === '' || !ctype_digit($prodStr)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid or missing product_id']);
        exit;
    }
    $productId = (int)$prodStr;

    mysqli_report(MYSQLI_REPORT_OFF);
    $mysqli = db();
    $mysqli->set_charset('utf8mb4');

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

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Using prepared statement with '?' placeholder and bind_param() to safely
    // handle $productId. Even if malicious SQL is in $productId, it cannot execute
    // because it's bound as an integer parameter, not concatenated into SQL.
    // ============================================================================
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
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Product not found']);
        exit;
    }

    // Decode categories JSON → tags array for frontend compatibility
    $tags = [];
    if (!empty($row['categories'])) {
        $decoded = json_decode($row['categories'], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $tags = array_values(array_filter($decoded, fn($v) => is_string($v) && $v !== ''));
        }
    }

    // Decode photos JSON to array if possible
    $photos = [];
    if (!empty($row['photos'])) {
        $decodedPhotos = json_decode($row['photos'], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decodedPhotos)) {
            $photos = $decodedPhotos;
        }
    }

    // Build seller display name
    $seller = 'Unknown Seller';
    $first = trim((string)($row['first_name'] ?? ''));
    $last  = trim((string)($row['last_name'] ?? ''));
    if ($first !== '' || $last !== '') {
        $seller = trim($first . ' ' . $last);
    } elseif (!empty($row['email'])) {
        $seller = (string)$row['email'];
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $out = [
        // core
        'product_id'    => (int)$row['product_id'],
        'title'         => escapeHtml($row['title'] ?? 'Untitled'),
        'description'   => escapeHtml($row['description'] ?? ''),
        'listing_price' => $row['listing_price'] !== null ? (float)$row['listing_price'] : null,

        // normalized fields expected by frontend
        'tags'          => $tags,                 // derived from categories
        'categories'    => $row['categories'] ?? null, // raw JSON string for compatibility
        'item_location' => escapeHtml($row['item_location'] ?? ''),
        'item_condition'=> escapeHtml($row['item_condition'] ?? ''),
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
        'seller'        => escapeHtml($seller),
        'email'         => escapeHtml($row['email'] ?? ''),

        // convenience timestamp-like field
        'created_at'    => !empty($row['date_listed']) ? ($row['date_listed'] . ' 00:00:00') : null,
    ];

    echo json_encode($out, JSON_UNESCAPED_SLASHES);
    exit;

} catch (Throwable $e) {
    error_log('viewProduct error: ' . $e->getMessage());
    http_response_code(500);
    // XSS PROTECTION: Escape error message to prevent XSS if it contains user input
    // SECURITY: In production, consider removing 'detail' field to prevent information disclosure
    echo json_encode([
        'ok' => false,
        'error' => 'Server error',
        'detail' => escapeHtml($e->getMessage()),
    ]);
    exit;
}
