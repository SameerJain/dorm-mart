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

echo json_encode([
    'success'  => true,
    'conv_id'  => $convId,
    'messages' => $messages, // array of only-new messages
], JSON_UNESCAPED_SLASHES);