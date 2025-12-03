<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS request
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

    $conn = db();
    $conn->set_charset('utf8mb4');
    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $convId = isset($payload['conv_id']) ? (int)$payload['conv_id'] : 0;
    if ($convId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid conversation ID']);
        exit;
    }

    // Verify user is a participant in this conversation
    $checkStmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare conversation check');
    }
    $checkStmt->bind_param('i', $convId);
    $checkStmt->execute();
    $checkRes = $checkStmt->get_result();
    $convRow = $checkRes ? $checkRes->fetch_assoc() : null;
    $checkStmt->close();

    if (!$convRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Conversation not found']);
        exit;
    }

    $user1Id = (int)$convRow['user1_id'];
    $user2Id = (int)$convRow['user2_id'];
    $isUser1 = $userId === $user1Id;
    $isUser2 = $userId === $user2Id;

    if (!$isUser1 && !$isUser2) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Not authorized to delete this conversation']);
        exit;
    }

    // Check if already deleted by this user
    if (($isUser1 && (int)$convRow['user1_deleted'] === 1) || ($isUser2 && (int)$convRow['user2_deleted'] === 1)) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Conversation already deleted']);
        exit;
    }

    // Get count of scheduled purchases to delete
    $countStmt = $conn->prepare('SELECT COUNT(*) as cnt FROM scheduled_purchase_requests WHERE conversation_id = ?');
    $countStmt->bind_param('i', $convId);
    $countStmt->execute();
    $countRes = $countStmt->get_result();
    $countRow = $countRes ? $countRes->fetch_assoc() : null;
    $countStmt->close();
    $scheduledPurchaseCount = $countRow ? (int)$countRow['cnt'] : 0;

    // Get scheduled purchases to update item status BEFORE deleting
    $scheduledStmt = $conn->prepare('SELECT request_id, inventory_product_id, status FROM scheduled_purchase_requests WHERE conversation_id = ?');
    $scheduledStmt->bind_param('i', $convId);
    $scheduledStmt->execute();
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
            $checkOtherStmt->execute();
            $checkOtherRes = $checkOtherStmt->get_result();
            $checkOtherRow = $checkOtherRes ? $checkOtherRes->fetch_assoc() : null;
            $checkOtherStmt->close();

            $hasOtherAccepted = $checkOtherRow && (int)$checkOtherRow['cnt'] > 0;

            // Only set back to Active if no other accepted scheduled purchases exist
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

    // Delete scheduled purchases AFTER updating item status
    $deleteScheduledStmt = $conn->prepare('DELETE FROM scheduled_purchase_requests WHERE conversation_id = ?');
    $deleteScheduledStmt->bind_param('i', $convId);
    $deleteScheduledStmt->execute();
    $deleteScheduledStmt->close();

    $cpStmt = $conn->prepare('DELETE FROM conversation_participants WHERE conv_id = ? AND user_id = ?');
    if ($cpStmt) {
        $cpStmt->bind_param('ii', $convId, $userId);
        $cpStmt->execute();
        $cpStmt->close();
    }


    // Mark conversation as deleted for this user
    if ($isUser1) {
        $updateStmt = $conn->prepare('UPDATE conversations SET user1_deleted = 1 WHERE conv_id = ?');
    } else {
        $updateStmt = $conn->prepare('UPDATE conversations SET user2_deleted = 1 WHERE conv_id = ?');
    }
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare update');
    }
    $updateStmt->bind_param('i', $convId);
    $updateStmt->execute();
    $updateStmt->close();

    $flagStmt = $conn->prepare('SELECT user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if ($flagStmt) {
        $flagStmt->bind_param('i', $convId);
        $flagStmt->execute();
        $flagRes = $flagStmt->get_result();
        $flagRow = $flagRes ? $flagRes->fetch_assoc() : null;
        $flagStmt->close();

        // If both users have deleted this conversation, hard-delete it.
        if ($flagRow && (int)$flagRow['user1_deleted'] === 1 && (int)$flagRow['user2_deleted'] === 1) {
            // Thanks to ON DELETE CASCADE on fk_msg_conv and fk_cp_conv,
            // this will also delete all messages and conversation_participants rows.
            $delConvStmt = $conn->prepare('DELETE FROM conversations WHERE conv_id = ?');
            if ($delConvStmt) {
                $delConvStmt->bind_param('i', $convId);
                $delConvStmt->execute();
                $delConvStmt->close();
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Conversation deleted successfully',
        'deleted_scheduled_purchases' => $scheduledPurchaseCount,
    ]);
    
    $conn->close();
} catch (Throwable $e) {
    error_log('delete_conversation error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
    if (isset($conn)) {
        $conn->close();
    }
}

