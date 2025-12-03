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
    $userId = require_login();

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $requestId = isset($payload['request_id']) ? (int)$payload['request_id'] : 0;

    if ($requestId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid request']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
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
        throw new RuntimeException('Failed to prepare select');
    }
    $selectStmt->bind_param('i', $requestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Request not found']);
        exit;
    }

    $sellerId = (int)$row['seller_user_id'];
    $buyerId = (int)$row['buyer_user_id'];
    
    // Allow both seller and buyer to cancel
    if ($userId !== $sellerId && $userId !== $buyerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not authorized to cancel this request']);
        exit;
    }

    // Prevent invalid cancellation states
    $currentStatus = (string)$row['status'];
    if ($currentStatus === 'cancelled') {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Request is already cancelled']);
        exit;
    }

    // Cannot cancel a declined request (buyer already rejected it)
    if ($currentStatus === 'declined') {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Cannot cancel a declined request']);
        exit;
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $updateStmt = $conn->prepare('UPDATE scheduled_purchase_requests SET status = ?, canceled_by_user_id = ? WHERE request_id = ? LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare update');
    }
    $status = 'cancelled';
    $updateStmt->bind_param('sii', $status, $userId, $requestId);
    $updateStmt->execute();
    $updateStmt->close();
    
    // Revert item status to "Active" when cancelled, but only if no other accepted purchases exist
    // This ensures item becomes available again only when truly free of all accepted scheduled purchases
    $inventoryProductId = (int)$row['inventory_product_id'];
    if ($inventoryProductId > 0) {
        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $checkOtherAcceptedStmt = $conn->prepare('SELECT COUNT(*) as cnt FROM scheduled_purchase_requests WHERE inventory_product_id = ? AND status = ? AND request_id != ?');
        $acceptedStatus = 'accepted';
        $checkOtherAcceptedStmt->bind_param('isi', $inventoryProductId, $acceptedStatus, $requestId);
        $checkOtherAcceptedStmt->execute();
        $checkRes = $checkOtherAcceptedStmt->get_result();
        $checkRow = $checkRes ? $checkRes->fetch_assoc() : null;
        $checkOtherAcceptedStmt->close();
        
        $hasOtherAccepted = $checkRow && (int)$checkRow['cnt'] > 0;
        
        // Only set back to Active if no other accepted scheduled purchases exist
        if (!$hasOtherAccepted) {
            // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
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
    
    // Create special message in chat
    $conversationId = isset($row['conversation_id']) ? (int)$row['conversation_id'] : 0;
    if ($conversationId > 0) {
        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $cancellerStmt = $conn->prepare('SELECT first_name, last_name FROM user_accounts WHERE user_id = ? LIMIT 1');
        $cancellerStmt->bind_param('i', $userId);
        $cancellerStmt->execute();
        $cancellerRes = $cancellerStmt->get_result();
        $cancellerRow = $cancellerRes ? $cancellerRes->fetch_assoc() : null;
        $cancellerStmt->close();
        
        $cancellerFirstName = $cancellerRow ? trim((string)$cancellerRow['first_name']) : '';
        $cancellerLastName = $cancellerRow ? trim((string)$cancellerRow['last_name']) : '';
        $cancellerDisplayName = '';
        if ($cancellerFirstName !== '' && $cancellerLastName !== '') {
            $cancellerDisplayName = $cancellerFirstName . ' ' . $cancellerLastName;
        } else {
            $cancellerDisplayName = 'User ' . $userId;
        }
        
        $messageContent = $cancellerDisplayName . ' has cancelled the scheduled purchase.';
        
        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
        $convStmt->bind_param('i', $conversationId);
        $convStmt->execute();
        $convRes = $convStmt->get_result();
        $convRow = $convRes ? $convRes->fetch_assoc() : null;
        $convStmt->close();
        
        if ($convRow) {
            $msgSenderId = $userId;
            $msgReceiverId = ($convRow['user1_id'] == $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
            
            // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
            $nameStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
            $nameStmt->bind_param('ii', $msgSenderId, $msgReceiverId);
            $nameStmt->execute();
            $nameRes = $nameStmt->get_result();
            $names = [];
            while ($nameRow = $nameRes->fetch_assoc()) {
                $id = (int)$nameRow['user_id'];
                $full = trim((string)$nameRow['first_name'] . ' ' . (string)$nameRow['last_name']);
                $names[$id] = $full !== '' ? $full : ('User ' . $id);
            }
            $nameStmt->close();
            
            $senderName = $names[$msgSenderId] ?? ('User ' . $msgSenderId);
            $receiverName = $names[$msgReceiverId] ?? ('User ' . $msgReceiverId);
            
            $metadata = json_encode([
                'type' => 'schedule_cancelled',
                'request_id' => $requestId,
            ], JSON_UNESCAPED_SLASHES);
            
            // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
            $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $senderName, $receiverName, $messageContent, $metadata);
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

    $response = [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'status' => 'cancelled',
        ],
    ];

    echo json_encode($response);
} catch (Throwable $e) {
    error_log('scheduled-purchase cancel error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

