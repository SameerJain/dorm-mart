<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

$convId = isset($_GET['conv_id']) ? (int) $_GET['conv_id'] : 0;
if ($convId <= 0) {
    send_json_error(400, 'conv_id is required');
}

// --- fetch all messages for this conversation (oldest first) ---
$stmt = $conn->prepare(
    'SELECT
         message_id, conv_id, sender_id, receiver_id, content, image_url, metadata,
         DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at,  -- ISO UTC
         DATE_FORMAT(edited_at,  "%Y-%m-%dT%H:%i:%sZ") AS edited_at    -- ISO UTC (NULL stays NULL)
       FROM messages
      WHERE conv_id = ?
      ORDER BY message_id ASC'
);

if (!$stmt) {
    send_json_error(500, 'Database error');
}
$stmt->bind_param('i', $convId);
if (!$stmt->execute()) {
    $stmt->close();
    send_json_error(500, 'Database error');
}
$res = $stmt->get_result();
$messages = [];
while ($row = $res->fetch_assoc()) {
    // Enrich schedule_request messages with current scheduled purchase status
    $metadata = json_decode($row['metadata'] ?? '{}', true);
    if (isset($metadata['type']) && $metadata['type'] === 'schedule_request' && isset($metadata['request_id'])) {
        $requestId = (int) $metadata['request_id'];
        // Fetch current status and buyer_response_at from scheduled_purchase_requests
        $statusStmt = $conn->prepare('SELECT status, buyer_response_at FROM scheduled_purchase_requests WHERE request_id = ? LIMIT 1');
        if ($statusStmt) {
            $statusStmt->bind_param('i', $requestId);
            $statusStmt->execute();
            $statusRes = $statusStmt->get_result();
            if ($statusRes && $statusRes->num_rows > 0) {
                $statusRow = $statusRes->fetch_assoc();
                // Add status and buyer_response_at to metadata
                $metadata['scheduled_purchase_status'] = (string) $statusRow['status'];
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
        $confirmRequestId = (int) $metadata['confirm_request_id'];
        // Fetch current status and buyer_response_at from confirm_purchase_requests
        $confirmStatusStmt = $conn->prepare('SELECT status, buyer_response_at FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
        if ($confirmStatusStmt) {
            $confirmStatusStmt->bind_param('i', $confirmRequestId);
            $confirmStatusStmt->execute();
            $confirmStatusRes = $confirmStatusStmt->get_result();
            if ($confirmStatusRes && $confirmStatusRes->num_rows > 0) {
                $confirmStatusRow = $confirmStatusRes->fetch_assoc();
                // Add status and buyer_response_at to metadata
                $metadata['confirm_purchase_status'] = (string) $confirmStatusRow['status'];
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
    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
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

// --- fetch item_deleted status from conversations table ---
$itemDeleted = false;
$stmt = $conn->prepare('SELECT item_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
if ($stmt) {
    $stmt->bind_param('i', $convId);
    if ($stmt->execute()) {
        $stmt->bind_result($itemDeletedFlag);
        if ($stmt->fetch()) {
            $itemDeleted = (bool) $itemDeletedFlag;
        }
    }
    $stmt->close();
}

send_json_success([
    'conv_id' => $convId,
    'messages' => $messages,
    'item_deleted' => $itemDeleted
]);