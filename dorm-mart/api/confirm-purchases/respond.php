<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/helpers.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$buyerId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $confirmRequestId = isset($payload['confirm_request_id']) ? (int)$payload['confirm_request_id'] : 0;
    $action = isset($payload['action']) ? strtolower(trim((string)$payload['action'])) : '';

    if ($confirmRequestId <= 0 || ($action !== 'accept' && $action !== 'decline')) {
        send_json_error(400, 'Invalid request');
    }

    $conn->set_charset('utf8mb4');

    $selectStmt = $conn->prepare('
        SELECT cpr.*, inv.title AS item_title
        FROM confirm_purchase_requests cpr
        INNER JOIN INVENTORY inv ON inv.product_id = cpr.inventory_product_id
        WHERE cpr.confirm_request_id = ?
        LIMIT 1
    ');
    if (!$selectStmt) {
        send_json_error(500, 'Database error');
    }
    $selectStmt->bind_param('i', $confirmRequestId);
    if (!$selectStmt->execute()) {
        $selectStmt->close();
        send_json_error(500, 'Database error');
    }
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        send_json_error(404, 'Confirmation not found');
    }

    if ((int)$row['buyer_user_id'] !== $buyerId) {
        send_json_error(403, 'You are not allowed to respond to this confirmation');
    }

    $row = auto_finalize_confirm_request($conn, $row) ?? $row;
    if (($row['status'] ?? '') !== 'pending') {
        send_json_error(409, 'This confirmation has already been processed');
    }

    $nextStatus = $action === 'accept' ? 'buyer_accepted' : 'buyer_declined';
    $updateStmt = $conn->prepare('UPDATE confirm_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE confirm_request_id = ? AND status = \'pending\' LIMIT 1');
    if (!$updateStmt) {
        send_json_error(500, 'Database error');
    }
    $updateStmt->bind_param('si', $nextStatus, $confirmRequestId);
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        send_json_error(500, 'Database error');
    }
    $affected = $updateStmt->affected_rows;
    $updateStmt->close();

    if ($affected === 0) {
        send_json_error(409, 'Confirmation status already updated');
    }

    $selectStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
    if ($selectStmt) {
        $selectStmt->bind_param('i', $confirmRequestId);
        if ($selectStmt->execute()) {
            $res = $selectStmt->get_result();
            $row = $res ? $res->fetch_assoc() : $row;
        }
        $selectStmt->close();
    }

    $conversationId = (int)$row['conversation_id'];
    $sellerId = (int)$row['seller_user_id'];
    $metadataType = $action === 'accept' ? 'confirm_accepted' : 'confirm_denied';
    $metadata = build_confirm_response_metadata($row, $metadataType);

    // Create a new message when buyer responds, similar to scheduled purchase
    // This ensures automatic refresh on both buyer and seller sides
    if ($conversationId > 0) {
        // Get buyer display name
        $names = get_user_display_names($conn, [$buyerId, $sellerId]);
        $buyerName = $names[$buyerId] ?? ('User ' . $buyerId);
        $sellerName = $names[$sellerId] ?? ('User ' . $sellerId);
        
        $actionText = $action === 'accept' ? 'accepted' : 'denied';
        $messageContent = $buyerName . ' has ' . $actionText . ' the Confirm Purchase form.';
        
        $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
        if ($convStmt) {
            $convStmt->bind_param('i', $conversationId);
            if ($convStmt->execute()) {
                $convRes = $convStmt->get_result();
                $convRow = $convRes ? $convRes->fetch_assoc() : null;
                
                if ($convRow) {
                    $msgSenderId = $buyerId;
                    $msgReceiverId = ($convRow['user1_id'] == $buyerId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
                    
                    try {
                        $findStmt = $conn->prepare('SELECT msg_id, metadata FROM messages WHERE conv_id = ? ORDER BY msg_id DESC');
                        if ($findStmt) {
                            $findStmt->bind_param('i', $conversationId);
                            if ($findStmt->execute()) {
                                $findRes = $findStmt->get_result();
                                $originalMsgId = null;
                                
                                while ($msgRow = $findRes->fetch_assoc()) {
                                    $msgMetadataJson = $msgRow['metadata'] ?? '{}';
                                    $msgMetadata = json_decode($msgMetadataJson, true);
                                    
                                    if (is_array($msgMetadata) && 
                                        ($msgMetadata['type'] ?? '') === 'confirm_request' &&
                                        ($msgMetadata['confirm_request_id'] ?? 0) === $confirmRequestId) {
                                        $originalMsgId = (int)$msgRow['msg_id'];
                                        break;
                                    }
                                }
                                
                                if ($originalMsgId !== null) {
                                    $deleteStmt = $conn->prepare('DELETE FROM messages WHERE msg_id = ? LIMIT 1');
                                    if ($deleteStmt) {
                                        $deleteStmt->bind_param('i', $originalMsgId);
                                        $deleteStmt->execute();
                                        $deleteStmt->close();
                                    }
                                }
                            }
                            $findStmt->close();
                        }
                    } catch (Throwable $e) {
                        error_log('Error deleting original confirm_request message: ' . $e->getMessage());
                    }
                    
                    $metadataJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
                    if ($metadataJson === false) {
                        throw new RuntimeException('Failed to encode metadata');
                    }
                    
                    $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
                    if ($msgStmt) {
                        $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $buyerName, $sellerName, $messageContent, $metadataJson);
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
            }
            $convStmt->close();
        }
    }

    if ($action === 'accept') {
        mark_inventory_as_sold($conn, $row);
        record_purchase_history($conn, $buyerId, (int)$row['inventory_product_id'], [
            'confirm_request_id' => $confirmRequestId,
            'is_successful' => (bool)$row['is_successful'],
            'final_price' => $row['final_price'] !== null ? (float)$row['final_price'] : null,
            'failure_reason' => $row['failure_reason'],
            'seller_notes' => $row['seller_notes'],
            'failure_reason_notes' => $row['failure_reason_notes'],
            'auto_accepted' => false,
        ]);
    }

    $responseAtIso = null;
    if (!empty($row['buyer_response_at'])) {
        $dt = date_create($row['buyer_response_at'], new DateTimeZone('UTC'));
        if ($dt) {
            $responseAtIso = $dt->format(DateTime::ATOM);
        }
    }

    send_json_success([
        'confirm_request_id' => $confirmRequestId,
        'status' => $nextStatus,
        'buyer_response_at' => $responseAtIso,
        'metadata' => $metadata,
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase respond error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}
