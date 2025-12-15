<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$sellerId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;

    if ($conversationId <= 0 || $productId <= 0) {
        send_json_error(400, 'conversation_id and product_id are required');
    }

    $conn->set_charset('utf8mb4');

    $convStmt = $conn->prepare('
        SELECT c.conv_id, c.product_id, inv.seller_id
        FROM conversations c
        INNER JOIN INVENTORY inv ON inv.product_id = c.product_id
        WHERE c.conv_id = ? AND c.product_id = ?
        LIMIT 1
    ');
    if (!$convStmt) {
        send_json_error(500, 'Database error');
    }
    $convStmt->bind_param('ii', $conversationId, $productId);
    if (!$convStmt->execute()) {
        $convStmt->close();
        send_json_error(500, 'Database error');
    }
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        send_json_error(404, 'Conversation not found for this product');
    }

    if ((int)$convRow['seller_id'] !== $sellerId) {
        send_json_error(403, 'You are not the seller for this listing');
    }

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
    $schedStmt = $conn->prepare($schedSql);
    if (!$schedStmt) {
        send_json_error(500, 'Database error');
    }
    $schedStmt->bind_param('ii', $conversationId, $productId);
    if (!$schedStmt->execute()) {
        $schedStmt->close();
        send_json_error(500, 'Database error');
    }
    $schedRes = $schedStmt->get_result();
    $schedRow = $schedRes ? $schedRes->fetch_assoc() : null;
    $schedStmt->close();

    if (!$schedRow) {
        send_json_error(404, 'No accepted scheduled purchase found for this chat');
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

    send_json_success([
        'scheduled_request_id' => (int)$schedRow['request_id'],
        'inventory_product_id' => (int)$schedRow['inventory_product_id'],
        'conversation_id' => $conversationId,
        'seller_user_id' => (int)$schedRow['seller_user_id'],
        'buyer_user_id' => (int)$schedRow['buyer_user_id'],
        'item_title' => $schedRow['item_title'] ?? 'Untitled',
        'buyer_name' => $buyerFullName,
        'meet_location' => $schedRow['meet_location'] ?? '',
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
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase prefill error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}
