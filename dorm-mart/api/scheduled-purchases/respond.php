<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$buyerId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $requestId = isset($payload['request_id']) ? (int)$payload['request_id'] : 0;
    $action = isset($payload['action']) ? strtolower(trim((string)$payload['action'])) : '';

    if ($requestId <= 0 || ($action !== 'accept' && $action !== 'decline')) {
        send_json_error(400, 'Invalid request');
    }

    $conn->set_charset('utf8mb4');

    $selectSql = <<<SQL
        SELECT
            spr.request_id,
            spr.status,
            spr.buyer_user_id,
            spr.seller_user_id,
            spr.verification_code,
            spr.inventory_product_id,
            spr.conversation_id,
            spr.meet_location,
            spr.meeting_at,
            spr.negotiated_price,
            spr.is_trade,
            spr.trade_item_description,
            spr.snapshot_price_nego,
            spr.snapshot_trades,
            spr.snapshot_meet_location,
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

    if ((int)$row['buyer_user_id'] !== $buyerId) {
        send_json_error(403, 'Not authorized to respond to this request');
    }

    if ($row['status'] !== 'pending') {
        send_json_error(409, 'Request has already been handled');
    }

    $inventoryProductId = (int)$row['inventory_product_id'];
    if ($action === 'accept' && $inventoryProductId > 0) {
        $itemStatusCheckStmt = $conn->prepare('SELECT item_status FROM INVENTORY WHERE product_id = ? LIMIT 1');
        if ($itemStatusCheckStmt) {
            $itemStatusCheckStmt->bind_param('i', $inventoryProductId);
            if ($itemStatusCheckStmt->execute()) {
                $itemStatusRes = $itemStatusCheckStmt->get_result();
                $itemStatusRow = $itemStatusRes ? $itemStatusRes->fetch_assoc() : null;
                
                if ($itemStatusRow && isset($itemStatusRow['item_status']) && $itemStatusRow['item_status'] === 'Pending') {
                    $itemStatusCheckStmt->close();
                    send_json_error(409, 'This item has already been accepted by another buyer');
                }
            }
            $itemStatusCheckStmt->close();
        }
    }

    $nextStatus = $action === 'accept' ? 'accepted' : 'declined';

    $updateStmt = $conn->prepare('UPDATE scheduled_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE request_id = ? LIMIT 1');
    if (!$updateStmt) {
        send_json_error(500, 'Database error');
    }
    $updateStmt->bind_param('si', $nextStatus, $requestId);
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        send_json_error(500, 'Database error');
    }
    $updateStmt->close();
    
    if ($inventoryProductId > 0) {
        if ($nextStatus === 'accepted') {
            $snapshotPriceNego = isset($row['snapshot_price_nego']) ? ((int)$row['snapshot_price_nego'] === 1) : null;
            $snapshotTrades = isset($row['snapshot_trades']) ? ((int)$row['snapshot_trades'] === 1) : null;
            $snapshotMeetLocation = isset($row['snapshot_meet_location']) ? trim((string)$row['snapshot_meet_location']) : null;
            $negotiatedPrice = isset($row['negotiated_price']) && $row['negotiated_price'] !== null 
                ? (float)$row['negotiated_price'] : null;
            
            if ($snapshotPriceNego === null || $snapshotTrades === null) {
                $fallbackStmt = $conn->prepare('SELECT price_nego, trades, item_location FROM INVENTORY WHERE product_id = ? LIMIT 1');
                if ($fallbackStmt) {
                    $fallbackStmt->bind_param('i', $inventoryProductId);
                    if ($fallbackStmt->execute()) {
                        $fallbackRes = $fallbackStmt->get_result();
                        $fallbackRow = $fallbackRes ? $fallbackRes->fetch_assoc() : null;
                        
                        if ($fallbackRow) {
                            if ($snapshotPriceNego === null) {
                                $snapshotPriceNego = isset($fallbackRow['price_nego']) ? ((int)$fallbackRow['price_nego'] === 1) : false;
                            }
                            if ($snapshotTrades === null) {
                                $snapshotTrades = isset($fallbackRow['trades']) ? ((int)$fallbackRow['trades'] === 1) : false;
                            }
                            if ($snapshotMeetLocation === null) {
                                $snapshotMeetLocation = isset($fallbackRow['item_location']) ? trim((string)$fallbackRow['item_location']) : null;
                            }
                            error_log('Warning: Using fallback inventory values for scheduled purchase ' . $requestId);
                        }
                    }
                    $fallbackStmt->close();
                }
            }
            
            $snapshotPriceNego = $snapshotPriceNego !== null ? $snapshotPriceNego : false;
            $snapshotTrades = $snapshotTrades !== null ? $snapshotTrades : false;
            
            $updateFields = ['item_status = ?'];
            $updateParams = ['Pending'];
            $updateTypes = 's';
            
            $updateFields[] = 'price_nego = ?';
            $updateParams[] = $snapshotPriceNego ? 1 : 0;
            $updateTypes .= 'i';
            
            $updateFields[] = 'trades = ?';
            $updateParams[] = $snapshotTrades ? 1 : 0;
            $updateTypes .= 'i';
            
            if ($snapshotMeetLocation !== null && $snapshotMeetLocation !== '') {
                $updateFields[] = 'item_location = ?';
                $updateParams[] = $snapshotMeetLocation;
                $updateTypes .= 's';
            }
            
            if ($negotiatedPrice !== null && $negotiatedPrice >= 0 && $snapshotPriceNego) {
                $updateFields[] = 'listing_price = ?';
                $updateParams[] = $negotiatedPrice;
                $updateTypes .= 'd';
            }
            
            $updateParams[] = $inventoryProductId;
            $updateParams[] = 'Sold';
            $updateTypes .= 'is';
            
            $updateSql = 'UPDATE INVENTORY SET ' . implode(', ', $updateFields) . ' WHERE product_id = ? AND item_status != ?';
            $itemStatusStmt = $conn->prepare($updateSql);
            if ($itemStatusStmt) {
                $itemStatusStmt->bind_param($updateTypes, ...$updateParams);
                if (!$itemStatusStmt->execute()) {
                    error_log('Failed to update inventory for scheduled purchase ' . $requestId . ': ' . $itemStatusStmt->error);
                }
                $itemStatusStmt->close();
            }
        } elseif ($nextStatus === 'declined') {
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
    }
    
    $conversationId = isset($row['conversation_id']) ? (int)$row['conversation_id'] : 0;
    if ($conversationId > 0) {
        $buyerStmt = $conn->prepare('SELECT first_name, last_name FROM user_accounts WHERE user_id = ? LIMIT 1');
        if ($buyerStmt) {
            $buyerStmt->bind_param('i', $buyerId);
            if ($buyerStmt->execute()) {
                $buyerRes = $buyerStmt->get_result();
                $buyerRow = $buyerRes ? $buyerRes->fetch_assoc() : null;
                $buyerFirstName = $buyerRow ? trim((string)$buyerRow['first_name']) : '';
                $buyerLastName = $buyerRow ? trim((string)$buyerRow['last_name']) : '';
                $buyerDisplayName = ($buyerFirstName !== '' && $buyerLastName !== '') 
                    ? ($buyerFirstName . ' ' . $buyerLastName) 
                    : ('User ' . $buyerId);
                
                $actionText = $action === 'accept' ? 'accepted' : 'denied';
                $messageContent = $buyerDisplayName . ' has ' . $actionText . ' the scheduled purchase.';
                
                $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
                if ($convStmt) {
                    $convStmt->bind_param('i', $conversationId);
                    if ($convStmt->execute()) {
                        $convRes = $convStmt->get_result();
                        $convRow = $convRes ? $convRes->fetch_assoc() : null;
                        
                        if ($convRow) {
                            $msgSenderId = $buyerId;
                            $msgReceiverId = ($convRow['user1_id'] == $buyerId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
                            
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
                                        'type' => $action === 'accept' ? 'schedule_accepted' : 'schedule_denied',
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
                                            
                                            if ($action === 'accept') {
                                                $nextStepsContent = 'Meet in-person at this agreed upon time and location to complete the exchange. Remember to use the verification code to verify identities! Once the exchange is done, the seller will send the Confirm Purchase form.';
                                                $nextStepsMetadata = json_encode([
                                                    'type' => 'next_steps',
                                                    'request_id' => $requestId,
                                                ], JSON_UNESCAPED_SLASHES);
                                                
                                                $nextStepsMsgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
                                                if ($nextStepsMsgStmt) {
                                                    $nextStepsMsgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $senderName, $receiverName, $nextStepsContent, $nextStepsMetadata);
                                                    $nextStepsMsgStmt->execute();
                                                    $nextStepsMsgStmt->close();
                                                }
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
            $buyerStmt->close();
        }
    }

    $meetingAtIso = null;
    if (!empty($row['meeting_at'])) {
        $dt = date_create($row['meeting_at'], new DateTimeZone('UTC'));
        if ($dt) {
            $meetingAtIso = $dt->format(DateTime::ATOM);
        }
    }

    $responseAtIso = (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);

    send_json_success([
        'request_id' => $requestId,
        'status' => $nextStatus,
        'verification_code' => (string)$row['verification_code'],
        'seller_user_id' => (int)$row['seller_user_id'],
        'buyer_user_id' => $buyerId,
        'inventory_product_id' => (int)$row['inventory_product_id'],
        'meet_location' => $row['meet_location'] ?? '',
        'meeting_at' => $meetingAtIso,
        'buyer_response_at' => $responseAtIso,
        'item' => [
            'title' => $row['item_title'] ?? 'Untitled',
        ],
    ]);
} catch (Throwable $e) {
    error_log('scheduled-purchase respond error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}


