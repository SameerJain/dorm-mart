<?php

declare(strict_types=1);

// Suppress any output that might interfere with headers
ob_start();

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../profile/profile_helpers.php';
require_once __DIR__ . '/../helpers/data_parsers.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    // Get filter parameters (with defaults for backward compatibility)
    $dateRange = isset($payload['dateRange']) ? (string)$payload['dateRange'] : (isset($payload['year']) ? 'Last Year' : 'All Time');
    $sort = isset($payload['sort']) ? (string)$payload['sort'] : 'Newest First';
    
    // Handle legacy year parameter for backward compatibility
    if (isset($payload['year']) && !isset($payload['dateRange'])) {
        $year = (int)$payload['year'];
        $currentYear = (int)date('Y');
        if ($year >= 2016 && $year <= $currentYear + 1) {
            $dateRange = 'Last Year'; // Approximate conversion
        }
    }

    // Calculate date range
    $tz = new DateTimeZone('UTC');
    $now = new DateTimeImmutable('now', $tz);
    $rangeStart = null;
    $rangeEnd = $now;

    switch ($dateRange) {
        case 'Last 30 Days':
            $rangeStart = $now->modify('-30 days');
            break;
        case 'Last 3 Months':
            $rangeStart = $now->modify('-3 months');
            break;
        case 'Last Year':
            $rangeStart = $now->modify('-1 year');
            break;
        case 'All Time':
        default:
            $rangeStart = null; // No start limit
            break;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // Load items with date filtering
    $historyItems = [];
    $legacyItems = [];
    
    if ($rangeStart !== null) {
        $historyItems = load_purchase_history_items($conn, $userId, $rangeStart, $rangeEnd);
        $legacyItems = load_legacy_purchased_items(
            $conn,
            $userId,
            $rangeStart->format('Y-m-d H:i:s'),
            $rangeEnd->format('Y-m-d H:i:s')
        );
    } else {
        // All time - load all items
        $historyItems = load_purchase_history_items($conn, $userId, null, $rangeEnd);
        $legacyItems = load_legacy_purchased_items(
            $conn,
            $userId,
            '1970-01-01 00:00:00', // Very old date to get all items
            $rangeEnd->format('Y-m-d H:i:s')
        );
    }

    $rows = array_merge($historyItems, $legacyItems);

    // Sort items
    switch ($sort) {
        case 'Oldest First':
            usort($rows, static function (array $a, array $b): int {
                $left = $a['transacted_at'] ?? '';
                $right = $b['transacted_at'] ?? '';
                if ($left === $right) {
                    return 0;
                }
                return strcmp($left, $right);
            });
            break;
        case 'Price: Low to High':
            usort($rows, static function (array $a, array $b): int {
                $priceA = isset($a['price']) ? (float)$a['price'] : 0;
                $priceB = isset($b['price']) ? (float)$b['price'] : 0;
                if ($priceA === $priceB) {
                    return 0;
                }
                return $priceA <=> $priceB;
            });
            break;
        case 'Price: High to Low':
            usort($rows, static function (array $a, array $b): int {
                $priceA = isset($a['price']) ? (float)$a['price'] : 0;
                $priceB = isset($b['price']) ? (float)$b['price'] : 0;
                if ($priceA === $priceB) {
                    return 0;
                }
                return $priceB <=> $priceA;
            });
            break;
        case 'Newest First':
        default:
            usort($rows, static function (array $a, array $b): int {
                $left = $a['transacted_at'] ?? '';
                $right = $b['transacted_at'] ?? '';
                if ($left === $right) {
                    return 0;
                }
                return strcmp($right, $left);
            });
            break;
    }

    ob_end_clean();
    send_json_success(['data' => $rows]);
} catch (Throwable $e) {
    ob_end_clean();
    error_log('purchase_history.php error: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    send_json_error(500, 'Internal server error');
}

/**
 * Filter purchase history entries by date range
 * 
 * @param array $entries Purchase history entries
 * @param ?DateTimeImmutable $start Start date (null = no start filter)
 * @param DateTimeImmutable $end End date
 * @return array Filtered entries with product_id and transacted_at
 */
function filter_purchase_history_by_date(array $entries, ?DateTimeImmutable $start, DateTimeImmutable $end): array
{
    $startTs = $start !== null ? $start->getTimestamp() : 0;
    $endTs = $end->getTimestamp();

    $filtered = [];
    foreach ($entries as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $productId = isset($entry['product_id']) ? (int)$entry['product_id'] : 0;
        if ($productId <= 0) {
            continue;
        }
        $recordedAt = isset($entry['recorded_at']) ? (string)$entry['recorded_at'] : '';
        $recordedTs = strtotime($recordedAt);
        if ($recordedTs === false) {
            continue;
        }
        // Apply date filter only if start is specified
        if ($start !== null && ($recordedTs < $startTs || $recordedTs >= $endTs)) {
            continue;
        }

        $filtered[] = [
            'product_id' => $productId,
            'transacted_at' => gmdate('Y-m-d H:i:s', $recordedTs),
        ];
    }

    return $filtered;
}

/**
 * Extract product IDs from filtered purchase history entries
 * 
 * @param array $filtered Filtered purchase history entries
 * @return array<int> Array of product IDs
 */
function extract_product_ids(array $filtered): array
{
    $productIds = [];
    foreach ($filtered as $entry) {
        $productId = $entry['product_id'] ?? 0;
        if ($productId > 0) {
            $productIds[$productId] = $productId;
        }
    }
    return array_values($productIds);
}

/**
 * Merge metadata with purchase history items
 * 
 * @param array $filtered Filtered purchase history entries
 * @param array $metadata Metadata indexed by product_id
 * @return array Merged items with metadata
 */
function merge_metadata_with_items(array $filtered, array $metadata): array
{
    $rows = [];
    foreach ($filtered as $entry) {
        $productId = $entry['product_id'];
        $meta = $metadata[$productId] ?? [];

        $title = $meta['title'] ?? ('Item #' . $productId);
        $sellerName = $meta['seller_name'] ?? 'Unknown seller';

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $rows[] = [
            'item_id' => $productId,
            'title' => $title,
            'sold_by' => $sellerName,
            'transacted_at' => $entry['transacted_at'],
            'image_url' => format_purchase_history_image_url($meta['image_url'] ?? ''),
            'categories' => $meta['categories'] ?? [],
            'price' => $meta['price'] ?? null,
        ];
    }

    return $rows;
}

/**
 * @return array<int, array<string, string|int|array>>
 */
function load_purchase_history_items(mysqli $conn, int $userId, ?DateTimeImmutable $start, DateTimeImmutable $end): array
{
    $stmt = $conn->prepare('SELECT items FROM purchase_history WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare purchase history lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row || empty($row['items'])) {
        return [];
    }

    $decoded = json_decode((string)$row['items'], true);
    if (!is_array($decoded)) {
        return [];
    }

    // Filter entries by date
    $filtered = filter_purchase_history_by_date($decoded, $start, $end);
    if (empty($filtered)) {
        return [];
    }

    // Extract product IDs and load metadata
    $productIds = extract_product_ids($filtered);
    $metadata = [];
    try {
        $metadata = load_inventory_metadata($conn, $productIds);
    } catch (Throwable $metaError) {
        error_log('Failed to load metadata for purchase history: ' . $metaError->getMessage());
        // Continue without metadata - use fallback values
    }

    // Merge metadata with filtered items
    return merge_metadata_with_items($filtered, $metadata);
}

/**
 * @return array<int, array<string, string>>
 */
function load_inventory_metadata(mysqli $conn, array $productIds): array
{
    if (empty($productIds)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($productIds), '?'));
    $sql = sprintf(
        'SELECT inv.product_id, inv.title, inv.photos, inv.seller_id, inv.listing_price, ua.first_name, ua.last_name
         FROM INVENTORY inv
         LEFT JOIN user_accounts ua ON ua.user_id = inv.seller_id
         WHERE inv.product_id IN (%s)',
        $placeholders
    );

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare inventory metadata lookup: ' . $conn->error);
    }

    $types = str_repeat('i', count($productIds));
    $params = [$types];
    foreach ($productIds as $idx => $value) {
        $productIds[$idx] = (int)$value;
        $params[] = &$productIds[$idx];
    }
    call_user_func_array([$stmt, 'bind_param'], $params);

    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to execute inventory metadata query: ' . $conn->error);
    }
    
    $res = $stmt->get_result();
    if (!$res) {
        $stmt->close();
        throw new RuntimeException('Failed to get result from inventory metadata query: ' . $conn->error);
    }
    
    $map = [];
    while ($row = $res->fetch_assoc()) {
        $sellerName = build_seller_name($row);
        if ($sellerName === 'Unknown Seller') {
            $sellerId = isset($row['seller_id']) ? (int)$row['seller_id'] : 0;
            $sellerName = $sellerId > 0 ? 'Seller #' . $sellerId : 'Unknown seller';
        }

        // Get price from listing_price column
        $price = null;
        if (isset($row['listing_price']) && $row['listing_price'] !== null) {
            $price = (float)$row['listing_price'];
        }

        $map[(int)$row['product_id']] = [
            'title' => $row['title'] ?? '',
            'seller_name' => $sellerName,
            'image_url' => format_purchase_history_image_url(get_first_photo($row['photos'] ?? null) ?? ''),
            'categories' => [], // Categories not needed for purchase history
            'price' => $price,
        ];
    }

    $stmt->close();

    return $map;
}

/**
 * @return array<int, array<string, string|int>>
 */
function load_legacy_purchased_items(mysqli $conn, int $userId, string $start, string $end): array
{
    $sql = 'SELECT item_id, title, sold_by, transacted_at, image_url
            FROM purchased_items
            WHERE buyer_user_id = ? AND transacted_at >= ? AND transacted_at < ?
            ORDER BY transacted_at DESC';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare legacy purchase lookup');
    }

    $stmt->bind_param('iss', $userId, $start, $end);
    $stmt->execute();
    $res = $stmt->get_result();

    // Get product IDs to fetch metadata
    $productIds = [];
    $tempRows = [];
    while ($row = $res->fetch_assoc()) {
        $productIds[] = (int)$row['item_id'];
        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $tempRows[(int)$row['item_id']] = [
            'item_id' => (int)$row['item_id'],
            'title' => $row['title'] ?? '',
            'sold_by' => $row['sold_by'] ?? '',
            'transacted_at' => $row['transacted_at'] ?? '',
            'image_url' => format_purchase_history_image_url($row['image_url'] ?? ''),
        ];
    }

    // Load metadata for legacy items
    $metadata = [];
    if (!empty($productIds)) {
        try {
            $metadata = load_inventory_metadata($conn, $productIds);
        } catch (Throwable $metaError) {
            // If metadata loading fails, continue without it
            error_log('Failed to load inventory metadata for legacy items: ' . $metaError->getMessage());
            $metadata = [];
        }
    }

    // Merge metadata into rows
    $rows = [];
    foreach ($tempRows as $itemId => $row) {
        $meta = $metadata[$itemId] ?? [];
        $rows[] = array_merge($row, [
            'categories' => $meta['categories'] ?? [],
            'price' => $meta['price'] ?? null,
        ]);
    }

    $stmt->close();

    return $rows;
}

function resolve_primary_photo($photos): string
{
    $firstPhoto = get_first_photo(is_string($photos) ? $photos : null);
    return $firstPhoto ? format_purchase_history_image_url($firstPhoto) : '';
}

function format_purchase_history_image_url($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }
    if (preg_match('#^https?://#i', $trimmed) || strpos($trimmed, 'data:') === 0) {
        return $trimmed;
    }

    if (strpos($trimmed, '/api/') === 0) {
        return qualify_purchase_history_url(rewrite_api_relative_path($trimmed));
    }

    require_once __DIR__ . '/../helpers/image_helpers.php';
    
    // Normalize image path first
    $normalized = normalize_image_path($trimmed);
    
    if ($normalized && strpos($normalized, '/images/') === 0) {
        return qualify_purchase_history_url(build_image_proxy_path($normalized));
    }

    if ($trimmed[0] === '/') {
        return qualify_purchase_history_url($trimmed);
    }

    return qualify_purchase_history_url(build_image_proxy_path('/images/' . ltrim($trimmed, '/')));
}

function build_image_proxy_path(string $source): string
{
    $apiBase = get_api_base_path();
    return rtrim($apiBase, '/') . '/media/image.php?url=' . rawurlencode($source);
}

function rewrite_api_relative_path(string $path): string
{
    $apiBase = get_api_base_path();
    if (strpos($path, '/api/') === 0) {
        return rtrim($apiBase, '/') . substr($path, strlen('/api'));
    }
    return $path;
}

function get_api_base_path(): string
{
    $script = $_SERVER['SCRIPT_NAME'] ?? '';
    if ($script === '') {
        return '/api';
    }
    $first = rtrim(dirname($script), '/');
    $second = rtrim(dirname($first), '/');
    if ($second === '' || $second === '.') {
        return '/api';
    }
    return $second;
}

function qualify_purchase_history_url(string $path): string
{
    if ($path === '') {
        return '';
    }
    if (preg_match('#^https?://#i', $path) || strpos($path, 'data:') === 0) {
        return $path;
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host === '') {
        return $path;
    }
    if ($path[0] !== '/') {
        $path = '/' . ltrim($path, '/');
    }
    return $scheme . $host . $path;
}
