<?php

declare(strict_types=1);

require_once __DIR__ . '/../database/db_connect.php';

/**
 * Fetches display names for the given user ids.
 *
 * @return array<int, string>
 */
function get_user_display_names(mysqli $conn, array $userIds): array
{
    if (empty($userIds)) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($userIds), '?'));
    $types = str_repeat('i', count($userIds));

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare(
        sprintf('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (%s)', $placeholders)
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare user lookup');
    }
    // bind_param requires references; build the array manually.
    $bindParams = [];
    $bindParams[] = $types;
    foreach ($userIds as $idx => $value) {
        $userIds[$idx] = (int)$value;
        $bindParams[] = &$userIds[$idx];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindParams);
    $stmt->execute();
    $res = $stmt->get_result();
    $names = [];
    while ($row = $res->fetch_assoc()) {
        $id = (int)$row['user_id'];
        $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
        $names[$id] = $full !== '' ? $full : ('User ' . $id);
    }
    $stmt->close();
    return $names;
}

/**
 * Inserts a chat message with JSON metadata and updates unread counts.
 *
 * @return int Inserted message id.
 */
function insert_confirm_chat_message(
    mysqli $conn,
    int $conversationId,
    int $senderId,
    int $receiverId,
    string $content,
    array $metadata
): int {
    $names = get_user_display_names($conn, [$senderId, $receiverId]);
    $senderName = $names[$senderId] ?? ('User ' . $senderId);
    $receiverName = $names[$receiverId] ?? ('User ' . $receiverId);
    $metadataJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
    if ($metadataJson === false) {
        throw new RuntimeException('Failed to encode metadata');
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
    if (!$msgStmt) {
        throw new RuntimeException('Failed to prepare message insert');
    }
    $msgStmt->bind_param('iiissss', $conversationId, $senderId, $receiverId, $senderName, $receiverName, $content, $metadataJson);
    $msgStmt->execute();
    $msgId = (int)$msgStmt->insert_id;
    $msgStmt->close();

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('iii', $msgId, $conversationId, $receiverId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    return $msgId;
}

/**
 * Upserts the buyer's purchase history record with the latest product id payload.
 *
 * @param array $payload Arbitrary data to capture (must be JSON encodable).
 */
function record_purchase_history(mysqli $conn, int $userId, int $productId, array $payload): void
{
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectStmt = $conn->prepare('SELECT history_id, items FROM purchase_history WHERE user_id = ? LIMIT 1');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare purchase history lookup');
    }
    $selectStmt->bind_param('i', $userId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    $nowIso = (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);
    $entry = [
        'product_id' => $productId,
        'recorded_at' => $nowIso,
        'confirm_payload' => $payload,
    ];

    if ($row) {
        $itemsJson = $row['items'] ?? '[]';
        $items = json_decode($itemsJson, true);
        if (!is_array($items)) {
            $items = [];
        }
        $items[] = $entry;
        $newJson = json_encode($items, JSON_UNESCAPED_SLASHES);
        if ($newJson === false) {
            throw new RuntimeException('Failed to encode purchase history items');
        }

        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $updateStmt = $conn->prepare('UPDATE purchase_history SET items = ?, updated_at = NOW() WHERE history_id = ? LIMIT 1');
        if (!$updateStmt) {
            throw new RuntimeException('Failed to prepare purchase history update');
        }
        $updateStmt->bind_param('si', $newJson, $row['history_id']);
        $updateStmt->execute();
        $updateStmt->close();
    } else {
        $itemsJson = json_encode([$entry], JSON_UNESCAPED_SLASHES);
        if ($itemsJson === false) {
            throw new RuntimeException('Failed to encode purchase history items');
        }

        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $insertStmt = $conn->prepare('INSERT INTO purchase_history (user_id, items) VALUES (?, ?)');
        if (!$insertStmt) {
            throw new RuntimeException('Failed to prepare purchase history insert');
        }
        $insertStmt->bind_param('is', $userId, $itemsJson);
        $insertStmt->execute();
        $insertStmt->close();
    }
}

function get_confirm_snapshot(array $row): array
{
    if (empty($row['payload_snapshot'])) {
        return [];
    }
    $decoded = json_decode($row['payload_snapshot'], true);
    return is_array($decoded) ? $decoded : [];
}

function resolve_confirm_final_price(mysqli $conn, array $row, array $snapshot): ?float
{
    if (isset($row['final_price']) && $row['final_price'] !== null) {
        return (float)$row['final_price'];
    }
    if (isset($snapshot['negotiated_price']) && $snapshot['negotiated_price'] !== null) {
        return (float)$snapshot['negotiated_price'];
    }

    $productId = isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : 0;
    if ($productId <= 0) {
        return null;
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $priceStmt = $conn->prepare('SELECT listing_price FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$priceStmt) {
        return null;
    }
    $priceStmt->bind_param('i', $productId);
    $priceStmt->execute();
    $res = $priceStmt->get_result();
    $priceRow = $res ? $res->fetch_assoc() : null;
    $priceStmt->close();

    if ($priceRow && $priceRow['listing_price'] !== null) {
        return (float)$priceRow['listing_price'];
    }

    return null;
}

function mark_inventory_as_sold(mysqli $conn, array $row): void
{
    if (empty($row['is_successful'])) {
        return;
    }

    $productId = isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : 0;
    $buyerId = isset($row['buyer_user_id']) ? (int)$row['buyer_user_id'] : 0;
    if ($productId <= 0 || $buyerId <= 0) {
        return;
    }

    $snapshot = get_confirm_snapshot($row);
    $finalPrice = resolve_confirm_final_price($conn, $row, $snapshot);
    if ($finalPrice === null) {
        $finalPrice = 0.0;
    }

    $status = 'Sold';
    $updateSql = 'UPDATE INVENTORY SET item_status = ?, sold = 1, final_price = ?, date_sold = CURDATE(), sold_to = ? WHERE product_id = ?';
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare($updateSql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare inventory sold update');
    }
    $stmt->bind_param('sdii', $status, $finalPrice, $buyerId, $productId);
    $stmt->execute();
    $stmt->close();
}

/**
 * If the pending confirm request is past expires_at, mark it as auto accepted,
 * deliver a chat message, and record purchase history. Returns the updated row.
 */
function auto_finalize_confirm_request(mysqli $conn, array $row): ?array
{
    if (($row['status'] ?? '') !== 'pending') {
        return $row;
    }

    $expiresAt = isset($row['expires_at']) ? DateTime::createFromFormat('Y-m-d H:i:s', $row['expires_at'], new DateTimeZone('UTC')) : false;
    if (!$expiresAt) {
        return $row;
    }

    $now = new DateTime('now', new DateTimeZone('UTC'));
    if ($now <= $expiresAt) {
        return $row;
    }

    $confirmId = (int)$row['confirm_request_id'];
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $updateStmt = $conn->prepare("UPDATE confirm_purchase_requests SET status = 'auto_accepted', auto_processed_at = NOW(), buyer_response_at = NOW() WHERE confirm_request_id = ? AND status = 'pending' LIMIT 1");
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare auto-finalize update');
    }
    $updateStmt->bind_param('i', $confirmId);
    $updateStmt->execute();
    $wasUpdated = $updateStmt->affected_rows > 0;
    $updateStmt->close();

    if (!$wasUpdated) {
        return $row;
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare confirm lookup');
    }
    $selectStmt->bind_param('i', $confirmId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $updatedRow = $res ? $res->fetch_assoc() : $row;
    $selectStmt->close();

    if ($updatedRow) {
        $conversationId = (int)$updatedRow['conversation_id'];
        $buyerId = (int)$updatedRow['buyer_user_id'];
        $sellerId = (int)$updatedRow['seller_user_id'];
        $metadata = build_confirm_response_metadata($updatedRow, 'confirm_auto_accepted');
        $content = 'Confirmation automatically accepted after 24 hours.';
        insert_confirm_chat_message($conn, $conversationId, $buyerId, $sellerId, $content, $metadata);

        mark_inventory_as_sold($conn, $updatedRow);
        record_purchase_history($conn, $buyerId, (int)$updatedRow['inventory_product_id'], [
            'confirm_request_id' => $confirmId,
            'is_successful' => (bool)$updatedRow['is_successful'],
            'final_price' => $updatedRow['final_price'] !== null ? (float)$updatedRow['final_price'] : null,
            'failure_reason' => $updatedRow['failure_reason'],
            'seller_notes' => $updatedRow['seller_notes'],
            'failure_reason_notes' => $updatedRow['failure_reason_notes'],
            'auto_accepted' => true,
        ]);
    }

    return $updatedRow;
}

/**
 * Builds a metadata payload for confirm responses so that React can display a card.
 */
function build_confirm_response_metadata(array $row, string $type): array
{
    $snapshot = [];
    if (!empty($row['payload_snapshot'])) {
        $decoded = json_decode($row['payload_snapshot'], true);
        if (is_array($decoded)) {
            $snapshot = $decoded;
        }
    }

    return [
        'type' => $type,
        'confirm_request_id' => (int)$row['confirm_request_id'],
        'scheduled_request_id' => isset($row['scheduled_request_id']) ? (int)$row['scheduled_request_id'] : null,
        'inventory_product_id' => isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : null,
        'is_successful' => isset($row['is_successful']) ? (bool)$row['is_successful'] : null,
        'final_price' => isset($row['final_price']) ? (float)$row['final_price'] : null,
        'seller_notes' => $row['seller_notes'] ?? null,
        'failure_reason' => $row['failure_reason'] ?? null,
        'failure_reason_notes' => $row['failure_reason_notes'] ?? null,
        'snapshot' => $snapshot,
        'responded_at' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM),
    ];
}
