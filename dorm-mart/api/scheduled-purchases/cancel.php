<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $requestId = isset($payload['request_id']) ? (int)$payload['request_id'] : 0;

    if ($requestId <= 0) {
        send_json_error(400, 'Invalid request');
    }

    $conn->set_charset('utf8mb4');

    $selectSql = <<<SQL
        SELECT
            spr.request_id,
            spr.status,
            spr.seller_user_id,
            spr.buyer_user_id,
            spr.conversation_id,
            spr.inventory_product_id,
            inv.title AS item_title
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        WHERE spr.request_id = ?
        LIMIT 1
    SQL;

    $selectStmt = $conn->prepare($selectSql);
    if (!$selectStmt) {
        send_json_error(500, 'Database error');
    }
    $selectStmt->bind_param('i', $requestId);
    if (!$selectStmt->execute()) {
        $selectStmt->close();
        send_json_error(500, 'Database error');
    }
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        send_json_error(404, 'Request not found');
    }

    $sellerId = (int)$row['seller_user_id'];
    $buyerId = (int)$row['buyer_user_id'];
    
    if ($userId !== $sellerId && $userId !== $buyerId) {
        send_json_error(403, 'Not authorized to cancel this request');
    }

    $currentStatus = (string)$row['status'];
    if ($currentStatus === 'cancelled') {
        send_json_error(409, 'Request is already cancelled');
    }

    if ($currentStatus === 'declined') {
        send_json_error(409, 'Cannot cancel a declined request');
    }

    $updateStmt = $conn->prepare('UPDATE scheduled_purchase_requests SET status = ?, canceled_by_user_id = ? WHERE request_id = ? LIMIT 1');
    if (!$updateStmt) {
        send_json_error(500, 'Database error');
    }
    $status = 'cancelled';
    $updateStmt->bind_param('sii', $status, $userId, $requestId);
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        send_json_error(500, 'Database error');
    }
    $updateStmt->close();
    
    // Revert item status to "Active" when cancelled, but only if no other accepted purchases exist
    // This ensures item becomes available again only when truly free of all accepted scheduled purchases
    $inventoryProductId = (int)$row['inventory_product_id'];
    if ($inventoryProductId > 0) {
        $checkOtherAcceptedStmt = $conn->prepare('SELECT COUNT(*) as cnt FROM scheduled_purchase_requests WHERE inventory_product_id = ? AND status = ? AND request_id != ?');
        if ($checkOtherAcceptedStmt) {
            $acceptedStatus = 'accepted';
            $checkOtherAcceptedStmt->bind_param('isi', $inventoryProductId, $acceptedStatus, $requestId);
            if ($checkOtherAcceptedStmt->execute()) {
                $checkRes = $checkOtherAcceptedStmt->get_result();
                $checkRow = $checkRes ? $checkRes->fetch_assoc() : null;
                $hasOtherAccepted = $checkRow && (int)$checkRow['cnt'] > 0;
                
                if (!$hasOtherAccepted) {
                    $itemStatusStmt = $conn->prepare('UPDATE INVENTORY SET item_status = ? WHERE product_id = ? AND item_status = ?');
                    if ($itemStatusStmt) {
                        $activeStatus = 'Active';
                        $pendingStatus = 'Pending';
                        $itemStatusStmt->bind_param('sis', $activeStatus, $inventoryProductId, $pendingStatus);
                        $itemStatusStmt->execute();
                        $itemStatusStmt->close();
                    }
                }
            }
            $checkOtherAcceptedStmt->close();
        }
    }
    
    $conversationId = isset($row['conversation_id']) ? (int)$row['conversation_id'] : 0;
    if ($conversationId > 0) {
        $cancellerStmt = $conn->prepare('SELECT first_name, last_name FROM user_accounts WHERE user_id = ? LIMIT 1');
        if ($cancellerStmt) {
            $cancellerStmt->bind_param('i', $userId);
            if ($cancellerStmt->execute()) {
                $cancellerRes = $cancellerStmt->get_result();
                $cancellerRow = $cancellerRes ? $cancellerRes->fetch_assoc() : null;
                $cancellerFirstName = $cancellerRow ? trim((string)$cancellerRow['first_name']) : '';
                $cancellerLastName = $cancellerRow ? trim((string)$cancellerRow['last_name']) : '';
                $cancellerDisplayName = ($cancellerFirstName !== '' && $cancellerLastName !== '') 
                    ? ($cancellerFirstName . ' ' . $cancellerLastName) 
                    : ('User ' . $userId);
                
                $messageContent = $cancellerDisplayName . ' has cancelled the scheduled purchase.';
                
                $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
                if ($convStmt) {
                    $convStmt->bind_param('i', $conversationId);
                    if ($convStmt->execute()) {
                        $convRes = $convStmt->get_result();
                        $convRow = $convRes ? $convRes->fetch_assoc() : null;
                        
                        if ($convRow) {
                            $msgSenderId = $userId;
                            $msgReceiverId = ($convRow['user1_id'] == $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
                            
                            $nameStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
                            if ($nameStmt) {
                                $nameStmt->bind_param('ii', $msgSenderId, $msgReceiverId);
                                if ($nameStmt->execute()) {
                                    $nameRes = $nameStmt->get_result();
                                    $names = [];
                                    while ($nameRow = $nameRes->fetch_assoc()) {
                                        $id = (int)$nameRow['user_id'];
                                        $full = trim((string)$nameRow['first_name'] . ' ' . (string)$nameRow['last_name']);
                                        $names[$id] = $full !== '' ? $full : ('User ' . $id);
                                    }
                                    $senderName = $names[$msgSenderId] ?? ('User ' . $msgSenderId);
                                    $receiverName = $names[$msgReceiverId] ?? ('User ' . $msgReceiverId);
                                    
                                    $metadata = json_encode([
                                        'type' => 'schedule_cancelled',
                                        'request_id' => $requestId,
                                    ], JSON_UNESCAPED_SLASHES);
                                    
                                    $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
                                    if ($msgStmt) {
                                        $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $senderName, $receiverName, $messageContent, $metadata);
                                        if ($msgStmt->execute()) {
                                            $msgId = $msgStmt->insert_id;
                                            
                                            $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
                                            if ($updateStmt) {
                                                $updateStmt->bind_param('iii', $msgId, $conversationId, $msgReceiverId);
                                                $updateStmt->execute();
                                                $updateStmt->close();
                                            }
                                        }
                                        $msgStmt->close();
                                    }
                                }
                                $nameStmt->close();
                            }
                        }
                    }
                    $convStmt->close();
                }
            }
            $cancellerStmt->close();
        }
    }

    send_json_success([
        'request_id' => $requestId,
        'status' => 'cancelled',
    ]);
} catch (Throwable $e) {
    error_log('scheduled-purchase cancel error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}

