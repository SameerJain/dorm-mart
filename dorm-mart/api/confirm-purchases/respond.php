<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/helpers.php';

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
    $buyerId = require_login();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $confirmRequestId = isset($payload['confirm_request_id']) ? (int)$payload['confirm_request_id'] : 0;
    $action = isset($payload['action']) ? strtolower(trim((string)$payload['action'])) : '';

    if ($confirmRequestId <= 0 || ($action !== 'accept' && $action !== 'decline')) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid request']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectStmt = $conn->prepare('
        SELECT cpr.*, inv.title AS item_title
        FROM confirm_purchase_requests cpr
        INNER JOIN INVENTORY inv ON inv.product_id = cpr.inventory_product_id
        WHERE cpr.confirm_request_id = ?
        LIMIT 1
    ');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare confirm lookup');
    }
    $selectStmt->bind_param('i', $confirmRequestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Confirmation not found']);
        exit;
    }

    if ((int)$row['buyer_user_id'] !== $buyerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You are not allowed to respond to this confirmation']);
        exit;
    }

    $row = auto_finalize_confirm_request($conn, $row) ?? $row;
    if (($row['status'] ?? '') !== 'pending') {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'This confirmation has already been processed']);
        exit;
    }

    $nextStatus = $action === 'accept' ? 'buyer_accepted' : 'buyer_declined';
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $updateStmt = $conn->prepare('UPDATE confirm_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE confirm_request_id = ? AND status = \'pending\' LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare confirm update');
    }
    $updateStmt->bind_param('si', $nextStatus, $confirmRequestId);
    $updateStmt->execute();
    $affected = $updateStmt->affected_rows;
    $updateStmt->close();

    if ($affected === 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Confirmation status already updated']);
        exit;
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
    $selectStmt->bind_param('i', $confirmRequestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : $row;
    $selectStmt->close();

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
        
        // Get conversation participants to determine sender/receiver
        $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
        $convStmt->bind_param('i', $conversationId);
        $convStmt->execute();
        $convRes = $convStmt->get_result();
        $convRow = $convRes ? $convRes->fetch_assoc() : null;
        $convStmt->close();
        
        if ($convRow) {
            $msgSenderId = $buyerId;
            $msgReceiverId = ($convRow['user1_id'] == $buyerId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
            
            // Delete the original confirm_request message BEFORE creating the new one
            // This ensures the original message is gone when the new response message is created
            try {
                // More direct approach: find and delete the message in one query if possible
                // First, find the message ID
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
                                break; // Found it, stop searching
                            }
                        }
                        $findStmt->close();
                        
                        // Delete the message if found
                        if ($originalMsgId !== null) {
                            $deleteStmt = $conn->prepare('DELETE FROM messages WHERE msg_id = ? LIMIT 1');
                            if ($deleteStmt) {
                                $deleteStmt->bind_param('i', $originalMsgId);
                                if ($deleteStmt->execute()) {
                                    $deleted = $deleteStmt->affected_rows > 0;
                                    error_log('Deleted original confirm_request message: msg_id=' . $originalMsgId . ', deleted=' . ($deleted ? 'yes' : 'no'));
                                } else {
                                    error_log('Failed to execute message deletion: ' . $deleteStmt->error);
                                }
                                $deleteStmt->close();
                            }
                        } else {
                            error_log('Original confirm_request message not found for deletion: confirm_request_id=' . $confirmRequestId);
                        }
                    } else {
                        error_log('Failed to execute message lookup for deletion: ' . $findStmt->error);
                        $findStmt->close();
                    }
                }
            } catch (Throwable $e) {
                // Log error but don't fail the request - deletion is optional
                error_log('Error deleting original confirm_request message: ' . $e->getMessage() . ' for confirm_request_id: ' . $confirmRequestId);
            }
            
            $metadataJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
            if ($metadataJson === false) {
                throw new RuntimeException('Failed to encode metadata');
            }
            
            // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
            $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $buyerName, $sellerName, $messageContent, $metadataJson);
            $msgStmt->execute();
            $msgId = $msgStmt->insert_id;
            $msgStmt->close();
            
            // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
            $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
            $updateStmt->bind_param('iii', $msgId, $conversationId, $msgReceiverId);
            $updateStmt->execute();
            $updateStmt->close();
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

    echo json_encode([
        'success' => true,
        'data' => [
            'confirm_request_id' => $confirmRequestId,
            'status' => $nextStatus,
            'buyer_response_at' => $responseAtIso,
            'metadata' => $metadata,
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase respond error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
