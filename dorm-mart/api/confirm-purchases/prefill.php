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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $sellerId = require_login();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;

    if ($conversationId <= 0 || $productId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'conversation_id and product_id are required']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $convStmt = $conn->prepare('
        SELECT c.conv_id, c.product_id, inv.seller_id
        FROM conversations c
        INNER JOIN INVENTORY inv ON inv.product_id = c.product_id
        WHERE c.conv_id = ? AND c.product_id = ?
        LIMIT 1
    ');
    if (!$convStmt) {
        throw new RuntimeException('Failed to prepare conversation lookup');
    }
    $convStmt->bind_param('ii', $conversationId, $productId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Conversation not found for this product']);
        exit;
    }

    if ((int)$convRow['seller_id'] !== $sellerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You are not the seller for this listing']);
        exit;
    }

    // Fetch the latest accepted scheduled purchase for this conversation/item
    $schedSql = <<<SQL
        SELECT
            spr.request_id,
            spr.inventory_product_id,
            spr.seller_user_id,
            spr.buyer_user_id,
            spr.meet_location,
            spr.meeting_at,
            spr.description,
            spr.negotiated_price,
            spr.trade_item_description,
            spr.is_trade,
            spr.snapshot_price_nego,
            spr.snapshot_trades,
            spr.snapshot_meet_location,
            spr.buyer_response_at,
            inv.title AS item_title,
            inv.listing_price,
            buyer.first_name AS buyer_first,
            buyer.last_name AS buyer_last
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        INNER JOIN user_accounts buyer ON buyer.user_id = spr.buyer_user_id
        WHERE spr.conversation_id = ?
          AND spr.inventory_product_id = ?
          AND spr.status = 'accepted'
        ORDER BY COALESCE(spr.updated_at, spr.buyer_response_at) DESC, spr.request_id DESC
        LIMIT 1
    SQL;
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $schedStmt = $conn->prepare($schedSql);
    if (!$schedStmt) {
        throw new RuntimeException('Failed to prepare scheduled purchase lookup');
    }
    $schedStmt->bind_param('ii', $conversationId, $productId);
    $schedStmt->execute();
    $schedRes = $schedStmt->get_result();
    $schedRow = $schedRes ? $schedRes->fetch_assoc() : null;
    $schedStmt->close();

    if (!$schedRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'No accepted scheduled purchase found for this chat']);
        exit;
    }

    $meetingIso = null;
    if (!empty($schedRow['meeting_at'])) {
        $mt = date_create($schedRow['meeting_at'], new DateTimeZone('UTC'));
        if ($mt) {
            $meetingIso = $mt->format(DateTime::ATOM);
        }
    }
    $buyerFullName = trim(($schedRow['buyer_first'] ?? '') . ' ' . ($schedRow['buyer_last'] ?? ''));
    if ($buyerFullName === '') {
        $buyerFullName = 'User ' . (int)$schedRow['buyer_user_id'];
    }

    $defaultPrice = null;
    if ($schedRow['negotiated_price'] !== null) {
        $defaultPrice = (float)$schedRow['negotiated_price'];
    } elseif ($schedRow['listing_price'] !== null) {
        $defaultPrice = (float)$schedRow['listing_price'];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'scheduled_request_id' => (int)$schedRow['request_id'],
            'inventory_product_id' => (int)$schedRow['inventory_product_id'],
            'conversation_id' => $conversationId,
            'seller_user_id' => (int)$schedRow['seller_user_id'],
            'buyer_user_id' => (int)$schedRow['buyer_user_id'],
            'item_title' => (string)$schedRow['item_title'],
            'buyer_name' => $buyerFullName,
            'meet_location' => (string)$schedRow['meet_location'],
            'meeting_at' => $meetingIso,
            'description' => $schedRow['description'] ?? '',
            'negotiated_price' => $schedRow['negotiated_price'] !== null ? (float)$schedRow['negotiated_price'] : null,
            'is_trade' => (bool)$schedRow['is_trade'],
            'trade_item_description' => $schedRow['trade_item_description'] ?? '',
            'default_final_price' => $defaultPrice,
            'available_failure_reasons' => [
                ['value' => 'buyer_no_show', 'label' => 'Buyer no showed'],
                ['value' => 'insufficient_funds', 'label' => 'Buyer did not have enough money'],
                ['value' => 'other', 'label' => 'Other (describe)'],
            ],
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase prefill error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
