<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

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
    $sellerId = require_login();

    $conn = db();
    $conn->set_charset('utf8mb4');

    $sql = <<<SQL
        SELECT
            spr.request_id,
            spr.inventory_product_id,
            spr.seller_user_id,
            spr.buyer_user_id,
            spr.conversation_id,
            spr.meet_location,
            spr.meeting_at,
            spr.verification_code,
            spr.description,
            spr.status,
            spr.buyer_response_at,
            spr.created_at,
            spr.updated_at,
            spr.negotiated_price,
            spr.is_trade,
            spr.trade_item_description,
            spr.canceled_by_user_id,
            inv.title AS item_title,
            inv.photos AS item_photos,
            inv.listing_price AS item_listing_price,
            ua.first_name AS buyer_first_name,
            ua.last_name AS buyer_last_name,
            canceler.first_name AS canceled_by_first_name,
            canceler.last_name AS canceled_by_last_name
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        INNER JOIN user_accounts ua ON ua.user_id = spr.buyer_user_id
        LEFT JOIN user_accounts canceler ON canceler.user_id = spr.canceled_by_user_id
        WHERE spr.seller_user_id = ?
        ORDER BY spr.created_at DESC
    SQL;

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
    }
    $stmt->bind_param('i', $sellerId);
    $stmt->execute();
    $res = $stmt->get_result();

    $records = [];
    while ($row = $res->fetch_assoc()) {
        $meetingAtIso = null;
        if (!empty($row['meeting_at'])) {
            $dt = date_create($row['meeting_at'], new DateTimeZone('UTC'));
            if ($dt) {
                $meetingAtIso = $dt->format(DateTime::ATOM);
            }
        }

        $responseAtIso = null;
        if (!empty($row['buyer_response_at'])) {
            $dtResp = date_create($row['buyer_response_at'], new DateTimeZone('UTC'));
            if ($dtResp) {
                $responseAtIso = $dtResp->format(DateTime::ATOM);
            }
        }

        $createdAtIso = null;
        if (!empty($row['created_at'])) {
            $dtCreated = date_create($row['created_at'], new DateTimeZone('UTC'));
            if ($dtCreated) {
                $createdAtIso = $dtCreated->format(DateTime::ATOM);
            }
        }

        $photos = [];
        if (!empty($row['item_photos'])) {
            $decoded = json_decode((string)$row['item_photos'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $photos = $decoded;
            }
        }

        $negotiatedPrice = isset($row['negotiated_price']) && $row['negotiated_price'] !== null 
            ? (float)$row['negotiated_price'] : null;
        $isTrade = isset($row['is_trade']) && ($row['is_trade'] === 1 || $row['is_trade'] === true || $row['is_trade'] === '1');
        $tradeItemDescription = isset($row['trade_item_description']) && $row['trade_item_description'] !== null 
            ? (string)$row['trade_item_description'] : null;
        
        $canceledBy = null;
        if (isset($row['canceled_by_user_id']) && $row['canceled_by_user_id'] !== null) {
            $canceledByUserId = (int)$row['canceled_by_user_id'];
            $canceledByFirstName = isset($row['canceled_by_first_name']) ? (string)$row['canceled_by_first_name'] : '';
            $canceledByLastName = isset($row['canceled_by_last_name']) ? (string)$row['canceled_by_last_name'] : '';
            $canceledBy = [
                'user_id' => $canceledByUserId,
                'first_name' => $canceledByFirstName,
                'last_name' => $canceledByLastName,
            ];
        }

        $records[] = [
            'request_id' => (int)$row['request_id'],
            'inventory_product_id' => (int)$row['inventory_product_id'],
            'seller_user_id' => (int)$row['seller_user_id'],
            'buyer_user_id' => (int)$row['buyer_user_id'],
            'conversation_id' => $row['conversation_id'] !== null ? (int)$row['conversation_id'] : null,
            'meet_location' => (string)$row['meet_location'],
            'meeting_at' => $meetingAtIso,
            'verification_code' => (string)$row['verification_code'],
            'description' => isset($row['description']) ? (string)$row['description'] : null,
            'status' => (string)$row['status'],
            'buyer_response_at' => $responseAtIso,
            'created_at' => $createdAtIso ? $createdAtIso : $row['created_at'],
            'updated_at' => $row['updated_at'],
            'negotiated_price' => $negotiatedPrice,
            'is_trade' => $isTrade,
            'trade_item_description' => $tradeItemDescription,
            'canceled_by' => $canceledBy,
            'item' => [
                'title' => (string)$row['item_title'],
                'photos' => $photos,
                'listing_price' => isset($row['item_listing_price']) ? (float)$row['item_listing_price'] : null,
            ],
            'buyer' => [
                'first_name' => (string)$row['buyer_first_name'],
                'last_name' => (string)$row['buyer_last_name'],
            ],
        ];
    }

    $stmt->close();

    echo json_encode(['success' => true, 'data' => $records]);
} catch (Throwable $e) {
    error_log('scheduled-purchase list_seller error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}


