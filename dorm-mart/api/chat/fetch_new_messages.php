<?php

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../security/security.php';
require __DIR__ . '/../database/db_connect.php';
setSecurityHeaders();
// Ensure CORS headers are present for React dev server and local PHP server
setSecureCORS();

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$conn = db();
$conn->query("SET time_zone = '+00:00'");

session_start(); 
$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$convId = isset($_GET['conv_id']) ? (int)$_GET['conv_id'] : 0;
$tsSec  = isset($_GET['ts']) ? (int)$_GET['ts'] : 0;

$stmt = $conn->prepare(
  'SELECT
       message_id, conv_id, sender_id, receiver_id, content, image_url, metadata,
       DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at,
       DATE_FORMAT(edited_at,  "%Y-%m-%dT%H:%i:%sZ") AS edited_at
     FROM messages
    WHERE conv_id = ?
      AND created_at > FROM_UNIXTIME(?)
    ORDER BY message_id ASC'
);
$stmt->bind_param('ii', $convId, $tsSec); // both ints
$stmt->execute();

$res = $stmt->get_result(); // requires mysqlnd; otherwise switch to bind_result loop
error_log(sprintf('[read_new_messages] num_rows=%d', $res->num_rows));
$messages = [];
while ($row = $res->fetch_assoc()) {
    // Enrich schedule_request messages with current scheduled purchase status
    $metadata = json_decode($row['metadata'] ?? '{}', true);
    if (isset($metadata['type']) && $metadata['type'] === 'schedule_request' && isset($metadata['request_id'])) {
        $requestId = (int)$metadata['request_id'];
        // Fetch current status and buyer_response_at from scheduled_purchase_requests
        $statusStmt = $conn->prepare('SELECT status, buyer_response_at FROM scheduled_purchase_requests WHERE request_id = ? LIMIT 1');
        if ($statusStmt) {
            $statusStmt->bind_param('i', $requestId);
            $statusStmt->execute();
            $statusRes = $statusStmt->get_result();
            if ($statusRes && $statusRes->num_rows > 0) {
                $statusRow = $statusRes->fetch_assoc();
                // Add status and buyer_response_at to metadata
                $metadata['scheduled_purchase_status'] = (string)$statusRow['status'];
                if (!empty($statusRow['buyer_response_at'])) {
                    $dt = date_create($statusRow['buyer_response_at'], new DateTimeZone('UTC'));
                    if ($dt) {
                        $metadata['buyer_response_at'] = $dt->format(DateTime::ATOM);
                    }
                }
                $row['metadata'] = json_encode($metadata, JSON_UNESCAPED_SLASHES);
            }
            $statusStmt->close();
        }
    }
    // Enrich confirm_request messages with current confirm purchase status
    if (isset($metadata['type']) && $metadata['type'] === 'confirm_request' && isset($metadata['confirm_request_id'])) {
        $confirmRequestId = (int)$metadata['confirm_request_id'];
        // Fetch current status and buyer_response_at from confirm_purchase_requests
        $confirmStatusStmt = $conn->prepare('SELECT status, buyer_response_at FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
        if ($confirmStatusStmt) {
            $confirmStatusStmt->bind_param('i', $confirmRequestId);
            $confirmStatusStmt->execute();
            $confirmStatusRes = $confirmStatusStmt->get_result();
            if ($confirmStatusRes && $confirmStatusRes->num_rows > 0) {
                $confirmStatusRow = $confirmStatusRes->fetch_assoc();
                // Add status and buyer_response_at to metadata
                $metadata['confirm_purchase_status'] = (string)$confirmStatusRow['status'];
                if (!empty($confirmStatusRow['buyer_response_at'])) {
                    $dt = date_create($confirmStatusRow['buyer_response_at'], new DateTimeZone('UTC'));
                    if ($dt) {
                        $metadata['buyer_response_at'] = $dt->format(DateTime::ATOM);
                    }
                }
                $row['metadata'] = json_encode($metadata, JSON_UNESCAPED_SLASHES);
            }
            $confirmStatusStmt->close();
        }
    }
    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $row['content'] = escapeHtml($row['content'] ?? '');
    $messages[] = $row;
}
$stmt->close();

// --- mark as read for the caller (sets "no unread") ---
$stmt = $conn->prepare(
    'UPDATE conversation_participants
        SET unread_count = 0,
            first_unread_msg_id = 0
      WHERE conv_id = ? AND user_id = ?'
);
$stmt->bind_param('ii', $convId, $userId);
$stmt->execute();
$stmt->close();

// Get typing status for other user in conversation
$typingStatus = [
    'is_typing' => false,
    'typing_user_first_name' => null
];

if ($convId > 0) {
    // Verify user has access to this conversation and get other user's ID
    $convStmt = $conn->prepare('SELECT user1_id, user2_id FROM conversations WHERE conv_id = ? LIMIT 1');
    $convStmt->bind_param('i', $convId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    if ($convRes && $convRes->num_rows > 0) {
        $convRow = $convRes->fetch_assoc();
        $otherUserId = ((int)$convRow['user1_id'] === $userId) ? (int)$convRow['user2_id'] : (int)$convRow['user1_id'];
        
        if ($otherUserId > 0) {
            // Get typing status for other user with their name, only if updated within last 8 seconds
            // The 8 second window accounts for network latency and polling intervals
            // Note: 30-second continuous typing timeout is handled on the frontend
            $typingStmt = $conn->prepare('SELECT ts.is_typing, ua.first_name 
                                        FROM typing_status ts
                                        INNER JOIN user_accounts ua ON ts.user_id = ua.user_id
                                        WHERE ts.conversation_id = ? AND ts.user_id = ? 
                                        AND ts.updated_at > DATE_SUB(NOW(), INTERVAL 8 SECOND)');
            $typingStmt->bind_param('ii', $convId, $otherUserId);
            $typingStmt->execute();
            $typingRes = $typingStmt->get_result();
            
            if ($typingRes && $typingRes->num_rows > 0) {
                $typingRow = $typingRes->fetch_assoc();
                $typingStatus['is_typing'] = (bool)(int)$typingRow['is_typing'];
                if ($typingStatus['is_typing'] && !empty($typingRow['first_name'])) {
                    // XSS PROTECTION: Escape user-generated content
                    $typingStatus['typing_user_first_name'] = escapeHtml($typingRow['first_name']);
                }
            }
            $typingStmt->close();
        }
    }
    $convStmt->close();
}

echo json_encode([
    'success'  => true,
    'conv_id'  => $convId,
    'messages' => $messages, // array of only-new messages
    'typing_status' => $typingStatus, // typing status for other user
], JSON_UNESCAPED_SLASHES);