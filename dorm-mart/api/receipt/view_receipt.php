<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../confirm-purchases/helpers.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    auth_boot_session();
    $userId = require_login();

    $productParam = trim((string)($_GET['product_id'] ?? $_GET['id'] ?? ''));
    $confirmParam = trim((string)($_GET['confirm_request_id'] ?? $_GET['confirm_id'] ?? ''));

    $productId = $productParam !== '' && ctype_digit($productParam) ? (int)$productParam : 0;
    $confirmRequestId = $confirmParam !== '' && ctype_digit($confirmParam) ? (int)$confirmParam : 0;

    if ($productId <= 0 && $confirmRequestId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'product_id or confirm_request_id is required','product_id' => $productId, 'confirm_request_id' => $confirmRequestId]);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    [$confirmRow, $resolvedProductId, $isAuthorized] = fetchConfirmRow($conn, $userId, $productId, $confirmRequestId);
    if (!$confirmRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Receipt not found for this listing','product_id' => $productId, 'confirm_request_id' => $confirmRequestId]);
        exit;
    }
    if (!$isAuthorized) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You are not part of this transaction']);
        exit;
    }

    // Auto finalize if the request expired without a response.
    $confirmRow = auto_finalize_confirm_request($conn, $confirmRow) ?? $confirmRow;

    $scheduledRow = fetchScheduledRequest($conn, (int)$confirmRow['scheduled_request_id']);
    if (!$scheduledRow) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Scheduled purchase details not found']);
        exit;
    }

    $productPayload = fetchProductPayload($conn, $resolvedProductId);
    if (!$productPayload) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Product not found for this receipt']);
        exit;
    }

    $snapshot = get_confirm_snapshot($confirmRow);
    $finalPrice = resolve_confirm_final_price($conn, $confirmRow, $snapshot);
    if ($finalPrice === null && $confirmRow['final_price'] !== null) {
        $finalPrice = (float)$confirmRow['final_price'];
    }

    $receiptPayload = buildReceiptPayload($confirmRow, $scheduledRow, $snapshot, $finalPrice);

    echo json_encode([
        'success' => true,
        'data' => [
            'product' => $productPayload,
            'receipt' => $receiptPayload,
        ],
    ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    error_log('view_receipt error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

/**
 * Fetches the relevant confirm_purchase_requests row for the user.
 *
 * @return array{0: ?array, 1: int} Returns the row and resolved product id.
 */
function fetchConfirmRow(mysqli $conn, int $userId, int $productId, int $confirmId): array
{
    if ($confirmId > 0) {
        $sql = 'SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ?';
        $params = [$confirmId];
        $types = 'i';
        if ($productId > 0) {
            $sql .= ' AND inventory_product_id = ?';
            $params[] = $productId;
            $types .= 'i';
        }
        $sql .= ' LIMIT 1';
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare confirm lookup');
        }
        $stmt->bind_param($types, ...$params);
    } else {
        if ($productId <= 0) {
            throw new InvalidArgumentException('product_id is required when confirm_request_id is not provided');
        }
        $stmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE inventory_product_id = ? ORDER BY confirm_request_id DESC LIMIT 1');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare confirm lookup');
        }
        $stmt->bind_param('i', $productId);
    }

    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    $resolvedProductId = $row ? (int)$row['inventory_product_id'] : $productId;
    $isAuthorized = false;
    if ($row) {
        $isAuthorized = ((int)$row['seller_user_id'] === $userId) || ((int)$row['buyer_user_id'] === $userId);
    }

    return [$row, $resolvedProductId, $isAuthorized];
}

function fetchScheduledRequest(mysqli $conn, int $requestId): ?array
{
    $sql = '
        SELECT spr.*,
               buyer.first_name AS buyer_first,
               buyer.last_name AS buyer_last,
               buyer.email AS buyer_email,
               seller.first_name AS seller_first,
               seller.last_name AS seller_last,
               seller.email AS seller_email
        FROM scheduled_purchase_requests spr
        LEFT JOIN user_accounts buyer ON buyer.user_id = spr.buyer_user_id
        LEFT JOIN user_accounts seller ON seller.user_id = spr.seller_user_id
        WHERE spr.request_id = ?
        LIMIT 1
    ';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare scheduled lookup');
    }
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ?: null;
}

function fetchProductPayload(mysqli $conn, int $productId): ?array
{
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

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare product lookup');
    }
    $stmt->bind_param('i', $productId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return null;
    }

    $tags = [];
    if (!empty($row['categories'])) {
        $decoded = json_decode($row['categories'], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $tags = array_values(array_filter($decoded, static fn($v) => is_string($v) && $v !== ''));
        }
    }

    $photos = [];
    if (!empty($row['photos'])) {
        $decodedPhotos = json_decode($row['photos'], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decodedPhotos)) {
            $photos = $decodedPhotos;
        }
    }

    $seller = formatDisplayName($row['first_name'] ?? '', $row['last_name'] ?? '', isset($row['seller_id']) ? 'Seller #' . $row['seller_id'] : 'Unknown Seller');
    if ($seller === '' && !empty($row['email'])) {
        $seller = (string)$row['email'];
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    return [
        'product_id'    => (int)$row['product_id'],
        'title'         => escapeHtml($row['title'] ?? 'Untitled'),
        'description'   => escapeHtml($row['description'] ?? ''),
        'listing_price' => $row['listing_price'] !== null ? (float)$row['listing_price'] : null,
        'tags'          => $tags,
        'categories'    => $row['categories'] ?? null,
        'item_location' => escapeHtml($row['item_location'] ?? ''),
        'item_condition'=> escapeHtml($row['item_condition'] ?? ''),
        'photos'        => $photos,
        'trades'        => (bool)$row['trades'],
        'price_nego'    => (bool)$row['price_nego'],
        'date_listed'   => $row['date_listed'] ?? null,
        'seller_id'     => isset($row['seller_id']) ? (int)$row['seller_id'] : null,
        'sold'          => (bool)$row['sold'],
        'final_price'   => $row['final_price'] !== null ? (float)$row['final_price'] : null,
        'date_sold'     => $row['date_sold'] ?? null,
        'sold_to'       => isset($row['sold_to']) ? (int)$row['sold_to'] : null,
        'seller'        => escapeHtml($seller !== '' ? $seller : 'Unknown Seller'),
        'email'         => escapeHtml($row['email'] ?? ''),
        'created_at'    => !empty($row['date_listed']) ? ($row['date_listed'] . ' 00:00:00') : null,
    ];
}

function buildReceiptPayload(array $confirmRow, array $scheduledRow, array $snapshot, ?float $finalPrice): array
{
    $meetingAt = $scheduledRow['meeting_at'] ?? ($snapshot['meeting_at'] ?? null);
    $meetLocation = $scheduledRow['meet_location']
        ?? ($snapshot['meet_location'] ?? ($snapshot['snapshot_meet_location'] ?? null));

    $purchaseDateIso = formatDateTimeValue(
        $confirmRow['buyer_response_at']
        ?? $confirmRow['auto_processed_at']
        ?? $confirmRow['updated_at']
        ?? $confirmRow['created_at']
        ?? $meetingAt
        ?? null
    );

    $sellerName = formatDisplayName($scheduledRow['seller_first'] ?? '', $scheduledRow['seller_last'] ?? '', 'Seller #' . $confirmRow['seller_user_id']);
    $buyerName = formatDisplayName($scheduledRow['buyer_first'] ?? '', $scheduledRow['buyer_last'] ?? '', 'Buyer #' . $confirmRow['buyer_user_id']);

    $negotiatedPrice = $scheduledRow['negotiated_price'] ?? ($snapshot['negotiated_price'] ?? null);
    $isTrade = isset($scheduledRow['is_trade']) ? (bool)$scheduledRow['is_trade'] : (isset($snapshot['is_trade']) ? (bool)$snapshot['is_trade'] : null);

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    return [
        'receipt_id' => (int)$confirmRow['confirm_request_id'],
        'inventory_product_id' => (int)$confirmRow['inventory_product_id'],
        'status' => escapeHtml($confirmRow['status'] ?? ''),
        'final_price' => $finalPrice,
        'seller_notes' => escapeHtml($confirmRow['seller_notes'] ?? ''),
        'failure_reason' => escapeHtml($confirmRow['failure_reason'] ?? ''),
        'failure_reason_notes' => escapeHtml($confirmRow['failure_reason_notes'] ?? ''),
        'purchase_date' => $purchaseDateIso,
        'meet_location' => escapeHtml($meetLocation ?? ''),
        'negotiated_price' => coerceFloat($negotiatedPrice),
        'trade_item_description' => escapeHtml($scheduledRow['trade_item_description'] ?? ($snapshot['trade_item_description'] ?? '')),
        'is_trade' => $isTrade,
        'comments' => escapeHtml($scheduledRow['description'] ?? ''),
        'buyer_notes' => null,
        'buyer_user_id' => (int)$confirmRow['buyer_user_id'],
        'seller_user_id' => (int)$confirmRow['seller_user_id'],
        'buyer_name' => escapeHtml($buyerName),
        'seller_name' => escapeHtml($sellerName),
        'buyer_email' => escapeHtml($scheduledRow['buyer_email'] ?? ''),
        'seller_email' => escapeHtml($scheduledRow['seller_email'] ?? ''),
        'snapshot' => $snapshot,
    ];
}

function formatDateTimeValue($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if ($value instanceof DateTimeInterface) {
        return $value->format(DateTime::ATOM);
    }
    if (is_numeric($value)) {
        $dt = new DateTime('@' . (int)$value);
        $dt->setTimezone(new DateTimeZone('UTC'));
        return $dt->format(DateTime::ATOM);
    }
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', (string)$value, new DateTimeZone('UTC'));
    if (!$dt) {
        $dt = date_create((string)$value);
    }
    return $dt ? $dt->format(DateTime::ATOM) : null;
}

function coerceFloat($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        return (float)$value;
    }
    return null;
}

function formatDisplayName($first, $last, $fallback): string
{
    $first = trim((string)$first);
    $last = trim((string)$last);
    $name = trim($first . ' ' . $last);
    if ($name !== '') {
        return $name;
    }
    return $fallback;
}
