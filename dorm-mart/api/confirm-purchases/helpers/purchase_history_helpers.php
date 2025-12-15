<?php

declare(strict_types=1);

require_once __DIR__ . '/../../database/db_connect.php';

/**
 * Upserts the buyer's purchase history record with the latest product id payload.
 *
 * @param array $payload Arbitrary data to capture (must be JSON encodable).
 */
function record_purchase_history(mysqli $conn, int $userId, int $productId, array $payload): void
{
    $selectStmt = $conn->prepare('SELECT history_id, items FROM purchase_history WHERE user_id = ? LIMIT 1');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare purchase history lookup');
    }
    $selectStmt->bind_param('i', $userId);
    if (!$selectStmt->execute()) {
        $selectStmt->close();
        throw new RuntimeException('Failed to execute purchase history lookup');
    }
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

        $updateStmt = $conn->prepare('UPDATE purchase_history SET items = ?, updated_at = NOW() WHERE history_id = ? LIMIT 1');
        if (!$updateStmt) {
            throw new RuntimeException('Failed to prepare purchase history update');
        }
        $updateStmt->bind_param('si', $newJson, $row['history_id']);
        if (!$updateStmt->execute()) {
            $updateStmt->close();
            throw new RuntimeException('Failed to update purchase history');
        }
        $updateStmt->close();
    } else {
        $itemsJson = json_encode([$entry], JSON_UNESCAPED_SLASHES);
        if ($itemsJson === false) {
            throw new RuntimeException('Failed to encode purchase history items');
        }

        $insertStmt = $conn->prepare('INSERT INTO purchase_history (user_id, items) VALUES (?, ?)');
        if (!$insertStmt) {
            throw new RuntimeException('Failed to prepare purchase history insert');
        }
        $insertStmt->bind_param('is', $userId, $itemsJson);
        if (!$insertStmt->execute()) {
            $insertStmt->close();
            throw new RuntimeException('Failed to insert purchase history');
        }
        $insertStmt->close();
    }
}



