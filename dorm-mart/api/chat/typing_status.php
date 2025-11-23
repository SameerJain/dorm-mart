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

// Create typing_status table if it doesn't exist
$createTableSql = "CREATE TABLE IF NOT EXISTS typing_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    is_typing TINYINT(1) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_conv_user (conversation_id, user_id),
    INDEX idx_conv_updated (conversation_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

$conn->query($createTableSql);

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

    // Insert or update typing status
    $isTypingInt = $isTyping ? 1 : 0;
    $stmt = $conn->prepare('INSERT INTO typing_status (conversation_id, user_id, is_typing, updated_at) 
                            VALUES (?, ?, ?, NOW()) 
                            ON DUPLICATE KEY UPDATE is_typing = ?, updated_at = NOW()');
    $stmt->bind_param('iiii', $conversationId, $userId, $isTypingInt, $isTypingInt);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update typing status']);
    }
    $stmt->close();

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

    // Get typing status for other user, only if updated within last 5 seconds
    $stmt = $conn->prepare('SELECT is_typing FROM typing_status 
                            WHERE conversation_id = ? AND user_id = ? 
                            AND updated_at > DATE_SUB(NOW(), INTERVAL 5 SECOND)');
    $stmt->bind_param('ii', $conversationId, $otherUserId);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $isTyping = false;
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $isTyping = (bool)(int)$row['is_typing'];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'is_typing' => $isTyping]);
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}

