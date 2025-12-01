<?php

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../security/security.php';
require __DIR__ . '/../database/db_connect.php';
setSecurityHeaders();
setSecureCORS();

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$conn = db();
$conn->set_charset('utf8mb4');

session_start();
$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Update typing status
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
        exit;
    }

    $conversationId = isset($body['conversation_id']) ? (int)$body['conversation_id'] : 0;
    $isTyping = isset($body['is_typing']) ? (bool)$body['is_typing'] : false;

    if ($conversationId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'conversation_id is required']);
        exit;
    }

    // Verify user has access to this conversation
    $checkStmt = $conn->prepare('SELECT conv_id FROM conversations WHERE conv_id = ? AND (user1_id = ? OR user2_id = ?) LIMIT 1');
    $checkStmt->bind_param('iii', $conversationId, $userId, $userId);
    $checkStmt->execute();
    $checkRes = $checkStmt->get_result();
    if (!$checkRes || $checkRes->num_rows === 0) {
        $checkStmt->close();
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit;
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
            echo json_encode(['success' => true]);
        } else {
            $conn->rollback();
            $stmt->close();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to update typing status']);
        }
    } catch (Exception $e) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update typing status']);
    }

} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get typing status for other person in conversation
    $conversationId = isset($_GET['conversation_id']) ? (int)$_GET['conversation_id'] : 0;
    
    if ($conversationId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'conversation_id is required']);
        exit;
    }

    // Verify user has access to this conversation and get other user's ID
    $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
    $convStmt->bind_param('i', $conversationId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    if (!$convRes || $convRes->num_rows === 0) {
        $convStmt->close();
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Access denied']);
        exit;
    }
    $convRow = $convRes->fetch_assoc();
    $convStmt->close();

    // Determine other user's ID
    $otherUserId = ((int)$convRow['user1_id'] === $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
    
    if ($otherUserId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid conversation']);
        exit;
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

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $response = [
        'success' => true, 
        'is_typing' => $isTyping
    ];
    if ($isTyping && $typingUserFirstName) {
        $response['typing_user_first_name'] = escapeHtml($typingUserFirstName);
        // Only include last_name if available, but don't require it
        if ($typingUserLastName) {
            $response['typing_user_last_name'] = escapeHtml($typingUserLastName);
        }
    }
    echo json_encode($response);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}

