<?php

declare(strict_types=1);

require_once __DIR__ . '/../../database/db_connect.php';
require_once __DIR__ . '/user_helpers.php';
require_once __DIR__ . '/chat_helpers.php';
require_once __DIR__ . '/purchase_history_helpers.php';
require_once __DIR__ . '/price_helpers.php';

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
    $stmt = $conn->prepare($updateSql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare inventory sold update');
    }
    $stmt->bind_param('sdii', $status, $finalPrice, $buyerId, $productId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to mark inventory as sold');
    }
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
    $updateStmt = $conn->prepare("UPDATE confirm_purchase_requests SET status = 'auto_accepted', auto_processed_at = NOW(), buyer_response_at = NOW() WHERE confirm_request_id = ? AND status = 'pending' LIMIT 1");
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare auto-finalize update');
    }
    $updateStmt->bind_param('i', $confirmId);
    if (!$updateStmt->execute()) {
        $updateStmt->close();
        throw new RuntimeException('Failed to auto-finalize confirm request');
    }
    $wasUpdated = $updateStmt->affected_rows > 0;
    $updateStmt->close();

    if (!$wasUpdated) {
        return $row;
    }

    $selectStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare confirm lookup');
    }
    $selectStmt->bind_param('i', $confirmId);
    if (!$selectStmt->execute()) {
        $selectStmt->close();
        throw new RuntimeException('Failed to fetch updated confirm request');
    }
    $res = $selectStmt->get_result();
    $updatedRow = $res ? $res->fetch_assoc() : $row;
    $selectStmt->close();

    if ($updatedRow) {
        $conversationId = (int)$updatedRow['conversation_id'];
        $buyerId = (int)$updatedRow['buyer_user_id'];
        $sellerId = (int)$updatedRow['seller_user_id'];
        $metadata = build_confirm_response_metadata($updatedRow, 'confirm_auto_accepted');
        
        if ($conversationId > 0) {
            $names = get_user_display_names($conn, [$buyerId, $sellerId]);
            $buyerName = $names[$buyerId] ?? ('User ' . $buyerId);
            $sellerName = $names[$sellerId] ?? ('User ' . $sellerId);
            
            $content = 'Confirmation automatically accepted after 24 hours.';
            
            $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
            $convRow = null;
            if ($convStmt) {
                $convStmt->bind_param('i', $conversationId);
                if ($convStmt->execute()) {
                    $convRes = $convStmt->get_result();
                    $convRow = $convRes ? $convRes->fetch_assoc() : null;
                }
                $convStmt->close();
            }
            
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
                                    ($msgMetadata['confirm_request_id'] ?? 0) === $confirmId) {
                                    $originalMsgId = (int)$msgRow['msg_id'];
                                    break;
                                }
                            }
                            $findStmt->close();
                            
                            if ($originalMsgId !== null) {
                                $deleteStmt = $conn->prepare('DELETE FROM messages WHERE msg_id = ? LIMIT 1');
                                if ($deleteStmt) {
                                    $deleteStmt->bind_param('i', $originalMsgId);
                                    if ($deleteStmt->execute()) {
                                        $deleted = $deleteStmt->affected_rows > 0;
                                        error_log('Deleted original confirm_request message (auto-accept): msg_id=' . $originalMsgId . ', deleted=' . ($deleted ? 'yes' : 'no'));
                                    } else {
                                        error_log('Failed to execute message deletion (auto-accept): ' . $deleteStmt->error);
                                    }
                                    $deleteStmt->close();
                                }
                            } else {
                                error_log('Original confirm_request message not found for deletion (auto-accept): confirm_request_id=' . $confirmId);
                            }
                        } else {
                            error_log('Failed to execute message lookup for deletion (auto-accept): ' . $findStmt->error);
                            $findStmt->close();
                        }
                    }
                } catch (Throwable $e) {
                    error_log('Error deleting original confirm_request message (auto-accept): ' . $e->getMessage() . ' for confirm_request_id: ' . $confirmId);
                }
                
                $metadataJson = json_encode($metadata, JSON_UNESCAPED_SLASHES);
                if ($metadataJson === false) {
                    throw new RuntimeException('Failed to encode metadata');
                }
                
                $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
                if (!$msgStmt) {
                    throw new RuntimeException('Failed to prepare message insert');
                }
                $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $buyerName, $sellerName, $content, $metadataJson);
                if (!$msgStmt->execute()) {
                    $msgStmt->close();
                    throw new RuntimeException('Failed to insert auto-accept message');
                }
                $msgId = (int)$msgStmt->insert_id;
                $msgStmt->close();

                $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
                if ($updateStmt) {
                    $updateStmt->bind_param('iii', $msgId, $conversationId, $msgReceiverId);
                    $updateStmt->execute();
                    $updateStmt->close();
                }
            }
        }

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



