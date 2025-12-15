<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $conn->set_charset('utf8mb4');
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $convId = isset($payload['conv_id']) ? (int)$payload['conv_id'] : 0;
    if ($convId <= 0) {
        send_json_error(400, 'Invalid conversation ID');
    }

    $checkStmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$checkStmt) {
        send_json_error(500, 'Database error');
    }
    $checkStmt->bind_param('i', $convId);
    if (!$checkStmt->execute()) {
        $checkStmt->close();
        send_json_error(500, 'Database error');
    }
    $checkRes = $checkStmt->get_result();
    $convRow = $checkRes ? $checkRes->fetch_assoc() : null;
    $checkStmt->close();

    if (!$convRow) {
        send_json_error(404, 'Conversation not found');
    }

    $user1Id = (int)$convRow['user1_id'];
    $user2Id = (int)$convRow['user2_id'];
    $isUser1 = $userId === $user1Id;
    $isUser2 = $userId === $user2Id;

    if (!$isUser1 && !$isUser2) {
        send_json_error(403, 'Not authorized to delete this conversation');
    }

    if (($isUser1 && (int)$convRow['user1_deleted'] === 1) || ($isUser2 && (int)$convRow['user2_deleted'] === 1)) {
        send_json_error(409, 'Conversation already deleted');
    }

    $countStmt = $conn->prepare('SELECT COUNT(*) as cnt FROM scheduled_purchase_requests WHERE conversation_id = ?');
    if (!$countStmt) {
        send_json_error(500, 'Database error');
    }
    $countStmt->bind_param('i', $convId);
    if (!$countStmt->execute()) {
        $countStmt->close();
        send_json_error(500, 'Database error');
    }
    $countRes = $countStmt->get_result();
    $countRow = $countRes ? $countRes->fetch_assoc() : null;
    $countStmt->close();
    $scheduledPurchaseCount = $countRow ? (int)$countRow['cnt'] : 0;

    $scheduledStmt = $conn->prepare('SELECT request_id, inventory_product_id, status FROM scheduled_purchase_requests WHERE conversation_id = ?');
    if (!$scheduledStmt) {
        send_json_error(500, 'Database error');
    }
    $scheduledStmt->bind_param('i', $convId);
    if (!$scheduledStmt->execute()) {
        $scheduledStmt->close();
        send_json_error(500, 'Database error');
    }
    $scheduledRes = $scheduledStmt->get_result();
    $scheduledPurchases = [];
    $requestIds = [];
    while ($row = $scheduledRes->fetch_assoc()) {
        $requestId = (int)$row['request_id'];
        $scheduledPurchases[] = [
            'request_id' => $requestId,
            'inventory_product_id' => (int)$row['inventory_product_id'],
            'status' => (string)$row['status'],
        ];
        $requestIds[] = $requestId;
    }
    $scheduledStmt->close();

    // Update item status back to "Active" for accepted scheduled purchases BEFORE deleting
    // Only if no other accepted purchases exist for those items (excluding the ones we're about to delete)
    foreach ($scheduledPurchases as $sp) {
        if ($sp['status'] === 'accepted') {
            $productId = $sp['inventory_product_id'];
            $requestId = $sp['request_id'];
            // Check if there are other accepted scheduled purchases for this item (excluding ones we're deleting)
            $placeholders = implode(',', array_fill(0, count($requestIds), '?'));
            $checkOtherStmt = $conn->prepare("SELECT COUNT(*) as cnt FROM scheduled_purchase_requests WHERE inventory_product_id = ? AND status = ? AND request_id NOT IN ($placeholders)");
            $acceptedStatus = 'accepted';
            $params = array_merge([$productId, $acceptedStatus], $requestIds);
            $types = 'is' . str_repeat('i', count($requestIds));
            $checkOtherStmt->bind_param($types, ...$params);
            if (!$checkOtherStmt->execute()) {
                $checkOtherStmt->close();
                continue;
            }
            $checkOtherRes = $checkOtherStmt->get_result();
            $checkOtherRow = $checkOtherRes ? $checkOtherRes->fetch_assoc() : null;
            $checkOtherStmt->close();

            $hasOtherAccepted = $checkOtherRow && (int)$checkOtherRow['cnt'] > 0;

            if (!$hasOtherAccepted) {
                $itemStatusStmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND item_status = ?');
                if ($itemStatusStmt) {
                    $activeStatus = 'Active';
                    $pendingStatus = 'Pending';
                    $itemStatusStmt->bind_param('sis', $activeStatus, $productId, $pendingStatus);
                    $itemStatusStmt->execute();
                    $itemStatusStmt->close();
                }
            }
        }
    }

    $deleteScheduledStmt = $conn->prepare('DELETE FROM scheduled_purchase_requests WHERE conversation_id = ?');
    if ($deleteScheduledStmt) {
        $deleteScheduledStmt->bind_param('i', $convId);
        $deleteScheduledStmt->execute();
        $deleteScheduledStmt->close();
    }

    $cpStmt = $conn->prepare('DELETE FROM conversation_participants WHERE conv_id = ? AND user_id = ?');
    if ($cpStmt) {
        $cpStmt->bind_param('ii', $convId, $userId);
        $cpStmt->execute();
        $cpStmt->close();
    }

    if ($isUser1) {
        $updateStmt = $conn->prepare('UPDATE conversations SET user1_deleted = 1 WHERE conv_id = ?');
    } else {
        $updateStmt = $conn->prepare('UPDATE conversations SET user2_deleted = 1 WHERE conv_id = ?');
    }
    if (!$updateStmt) {
        send_json_error(500, 'Database error');
    }
    $updateStmt->bind_param('i', $convId);
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        send_json_error(500, 'Database error');
    }
    $updateStmt->close();

    $flagStmt = $conn->prepare('SELECT user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if ($flagStmt) {
        $flagStmt->bind_param('i', $convId);
        if ($flagStmt->execute()) {
            $flagRes = $flagStmt->get_result();
            $flagRow = $flagRes ? $flagRes->fetch_assoc() : null;

            if ($flagRow && (int)$flagRow['user1_deleted'] === 1 && (int)$flagRow['user2_deleted'] === 1) {
                $delConvStmt = $conn->prepare('DELETE FROM conversations WHERE conv_id = ?');
                if ($delConvStmt) {
                    $delConvStmt->bind_param('i', $convId);
                    $delConvStmt->execute();
                    $delConvStmt->close();
                }
            }
        }
        $flagStmt->close();
    }
    
    send_json_success([
        'conv_id' => $convId,
        'status' => 'deleted',
        'deleted_scheduled_purchases' => $scheduledPurchaseCount,
    ]);
} catch (Throwable $e) {
    error_log('delete_conversation error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

