<?php

declare(strict_types=1);

require_once __DIR__ . '/user_helpers.php';

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

    $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
    if (!$msgStmt) {
        throw new RuntimeException('Failed to prepare message insert');
    }
    $msgStmt->bind_param('iiissss', $conversationId, $senderId, $receiverId, $senderName, $receiverName, $content, $metadataJson);
    if (!$msgStmt->execute()) {
        $msgStmt->close();
        throw new RuntimeException('Failed to insert message');
    }
    $msgId = (int)$msgStmt->insert_id;
    $msgStmt->close();

    $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
    if ($updateStmt) {
        $updateStmt->bind_param('iii', $msgId, $conversationId, $receiverId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    return $msgId;
}

/**
 * Updates an existing confirm purchase message's metadata with response information.
 * This prevents creating duplicate messages when buyer responds.
 *
 * @param mysqli $conn Database connection
 * @param int $conversationId Conversation ID
 * @param int $confirmRequestId Confirm request ID to find the message
 * @param array $responseMetadata Metadata to merge into existing message metadata
 * @return bool True if message was found and updated, false otherwise
 */
function update_confirm_chat_message_metadata(
    mysqli $conn,
    int $conversationId,
    int $confirmRequestId,
    array $responseMetadata
): bool {
    try {
        $selectStmt = $conn->prepare('SELECT msg_id, metadata FROM messages WHERE conv_id = ? ORDER BY msg_id DESC');
        if (!$selectStmt) {
            error_log('Failed to prepare message lookup: ' . $conn->error);
            return false;
        }
        
        $selectStmt->bind_param('i', $conversationId);
        if (!$selectStmt->execute()) {
            error_log('Failed to execute message lookup: ' . $selectStmt->error);
            $selectStmt->close();
            return false;
        }
        
        $res = $selectStmt->get_result();
        $msgRow = null;
        
        while ($row = $res->fetch_assoc()) {
            $metadataJson = $row['metadata'] ?? '{}';
            $metadata = json_decode($metadataJson, true);
            
            if (is_array($metadata) && 
                ($metadata['type'] ?? '') === 'confirm_request' &&
                ($metadata['confirm_request_id'] ?? 0) === $confirmRequestId) {
                $msgRow = $row;
                break;
            }
        }
        
        $selectStmt->close();
        
        if (!$msgRow) {
            error_log('Confirm purchase message not found for confirm_request_id: ' . $confirmRequestId . ' in conversation: ' . $conversationId);
            return false;
        }
        
        $existingMetadataJson = $msgRow['metadata'] ?? '{}';
        $existingMetadata = json_decode($existingMetadataJson, true);
        if (!is_array($existingMetadata)) {
            error_log('Invalid metadata JSON for confirm_request_id: ' . $confirmRequestId);
            return false;
        }
        
        if (($existingMetadata['type'] ?? '') !== 'confirm_request') {
            error_log('Found message does not have type confirm_request for confirm_request_id: ' . $confirmRequestId);
            return false;
        }
        
        if (($existingMetadata['confirm_request_id'] ?? 0) !== $confirmRequestId) {
            error_log('Found message confirm_request_id mismatch for confirm_request_id: ' . $confirmRequestId);
            return false;
        }
        
        $updatedMetadata = array_merge($existingMetadata, $responseMetadata);
        
        $updatedMetadataJson = json_encode($updatedMetadata, JSON_UNESCAPED_SLASHES);
        if ($updatedMetadataJson === false) {
            error_log('Failed to encode updated metadata for confirm_request_id: ' . $confirmRequestId);
            return false;
        }
        
        $msgId = (int)$msgRow['msg_id'];
        $updateStmt = $conn->prepare('UPDATE messages SET metadata = ? WHERE msg_id = ? LIMIT 1');
        if (!$updateStmt) {
            error_log('Failed to prepare message update: ' . $conn->error);
            return false;
        }
        
        $updateStmt->bind_param('si', $updatedMetadataJson, $msgId);
        if (!$updateStmt->execute()) {
            error_log('Failed to execute message update: ' . $updateStmt->error);
            $updateStmt->close();
            return false;
        }
        
        $updateStmt->close();
        
        return true;
    } catch (Throwable $e) {
        error_log('Exception in update_confirm_chat_message_metadata: ' . $e->getMessage() . ' for confirm_request_id: ' . $confirmRequestId);
        return false;
    }
}



