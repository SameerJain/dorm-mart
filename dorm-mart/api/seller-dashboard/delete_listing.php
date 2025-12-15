<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $input = get_request_data();
    
    $token = $input['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        send_json_error(403, 'CSRF token validation failed');
    }
    
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    if ($id <= 0) {
        send_json_error(400, 'Invalid id');
    }

    // Before deleting the item, handle active conversations
    // Find all conversations associated with this product
    $convStmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname FROM conversations WHERE product_id = ?');
    if (!$convStmt) {
        throw new RuntimeException('Failed to prepare conversation query');
    }
    $convStmt->bind_param('i', $id);
    $convStmt->execute();
    $convResult = $convStmt->get_result();
    $conversations = [];
    while ($row = $convResult->fetch_assoc()) {
        $conversations[] = $row;
    }
    $convStmt->close();

    // For each conversation, insert a system message and mark as item_deleted
    foreach ($conversations as $conv) {
        $convId = (int)$conv['conv_id'];
        $user1Id = (int)$conv['user1_id'];
        $user2Id = (int)$conv['user2_id'];
        $user1Fname = (string)$conv['user1_fname'];
        $user2Fname = (string)$conv['user2_fname'];

        // Insert system message for item deletion
        // Both users will see this message when fetching conversation messages
        $deletionMessage = 'The item has been removed. This chat has been closed.';
        $metadata = json_encode([
            'type' => 'item_deleted'
        ], JSON_UNESCAPED_SLASHES);

        // Use user1_id as sender (system message, but needs valid sender_id)
        // Set receiver_id to user2_id - both users will see this message when fetching
        $msgStmt = $conn->prepare(
            'INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        if ($msgStmt) {
            $msgStmt->bind_param('iiissss', $convId, $user1Id, $user2Id, $user1Fname, $user2Fname, $deletionMessage, $metadata);
            $msgStmt->execute();
            $msgStmt->close();
        }

        // Mark conversation as item_deleted
        $updateStmt = $conn->prepare('UPDATE conversations SET item_deleted = TRUE WHERE conv_id = ?');
        if ($updateStmt) {
            $updateStmt->bind_param('i', $convId);
            $updateStmt->execute();
            $updateStmt->close();
        }
    }

    $stmt = $conn->prepare('DELETE FROM INVENTORY WHERE product_id = ? AND seller_id = ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare delete');
    }
    $stmt->bind_param('ii', $id, $userId);
    $stmt->execute();

    if ($stmt->affected_rows < 1) {
        send_json_error(404, 'Not found');
    }
    
    $stmt->close();

    send_json_success(['id' => $id]);
} catch (Throwable $e) {
    error_log('delete_listing error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}


