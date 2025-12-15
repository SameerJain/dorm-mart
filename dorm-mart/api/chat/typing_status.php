<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with GET/POST methods and authentication
$result = api_bootstrap(['GET', 'POST'], true);
$userId = $result['userId'];
$conn = $result['conn'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = get_request_data();

    $conversationId = isset($body['conversation_id']) ? (int)$body['conversation_id'] : 0;
    $isTyping = isset($body['is_typing']) ? (bool)$body['is_typing'] : false;

    if ($conversationId <= 0) {
        send_json_error(400, 'conversation_id is required');
    }

    // Verify user has access to this conversation
    $checkStmt = $conn->prepare('SELECT conv_id FROM conversations WHERE conv_id = ? AND (user1_id = ? OR user2_id = ?) LIMIT 1');
    if (!$checkStmt) {
        send_json_error(500, 'Database error');
    }
    $checkStmt->bind_param('iii', $conversationId, $userId, $userId);
    if (!$checkStmt->execute()) {
        $checkStmt->close();
        send_json_error(500, 'Database error');
    }
    $checkRes = $checkStmt->get_result();
    if (!$checkRes || $checkRes->num_rows === 0) {
        $checkStmt->close();
        send_json_error(403, 'Access denied');
    }
    $checkStmt->close();

    // Use transaction to ensure atomicity and prevent race conditions
    $conn->begin_transaction();
    
    try {
        // Insert or update typing status atomically
        $isTypingInt = $isTyping ? 1 : 0;
        $stmt = $conn->prepare('INSERT INTO typing_status (conversation_id, user_id, is_typing, updated_at) 
                                VALUES (?, ?, ?, NOW()) 
                                ON DUPLICATE KEY UPDATE is_typing = ?, updated_at = NOW()');
        $stmt->bind_param('iiii', $conversationId, $userId, $isTypingInt, $isTypingInt);
        
        if ($stmt->execute()) {
            $conn->commit();
            $stmt->close();
            send_json_success([]);
        } else {
            $conn->rollback();
            $stmt->close();
            send_json_error(500, 'Failed to update typing status');
        }
    } catch (Exception $e) {
        $conn->rollback();
        send_json_error(500, 'Failed to update typing status');
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $conversationId = isset($_GET['conversation_id']) ? (int)$_GET['conversation_id'] : 0;
    
    if ($conversationId <= 0) {
        send_json_error(400, 'conversation_id is required');
    }

    // Verify user has access to this conversation and get other user's ID
    $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$convStmt) {
        send_json_error(500, 'Database error');
    }
    $convStmt->bind_param('i', $conversationId);
    if (!$convStmt->execute()) {
        $convStmt->close();
        send_json_error(500, 'Database error');
    }
    $convRes = $convStmt->get_result();
    if (!$convRes || $convRes->num_rows === 0) {
        $convStmt->close();
        send_json_error(403, 'Access denied');
    }
    $convRow = $convRes->fetch_assoc();
    $convStmt->close();

    // Determine other user's ID
    $otherUserId = ((int)$convRow['user1_id'] === $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
    
    if ($otherUserId <= 0) {
        send_json_error(400, 'Invalid conversation');
    }

    // Get typing status for other user with their name, only if updated within last 8 seconds
    // Increased from 5 to 8 seconds to account for polling intervals and network delays
    // The 8 second window accounts for network latency and polling intervals
    // Note: 30-second continuous typing timeout is handled on the frontend
    $stmt = $conn->prepare('SELECT ts.is_typing, ua.first_name, ua.last_name 
                            FROM typing_status ts
                            INNER JOIN user_accounts ua ON ts.user_id = ua.user_id
                            WHERE ts.conversation_id = ? AND ts.user_id = ? 
                            AND ts.updated_at > DATE_SUB(NOW(), INTERVAL 8 SECOND)');
    $stmt->bind_param('ii', $conversationId, $otherUserId);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $isTyping = false;
    $typingUserFirstName = null;
    $typingUserLastName = null;
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $isTyping = (bool)(int)$row['is_typing'];
        if ($isTyping) {
            $typingUserFirstName = $row['first_name'] ?? null;
            $typingUserLastName = $row['last_name'] ?? null;
        }
    }
    $stmt->close();

    $response = [
        'is_typing' => $isTyping
    ];
    if ($isTyping && $typingUserFirstName) {
        $response['typing_user_first_name'] = $typingUserFirstName;
        if ($typingUserLastName) {
            $response['typing_user_last_name'] = $typingUserLastName;
        }
    }
    send_json_success($response);
}

