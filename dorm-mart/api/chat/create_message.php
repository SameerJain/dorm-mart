<?php

declare(strict_types=1);
header('Content-Type: application/json');

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
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

auth_boot_session();

// --- auth: require a logged-in user ---
$userId = require_login();

$sender = $userId;
$body = json_decode(file_get_contents('php://input'), true);

/* Conditional CSRF validation - only validate if token is provided */
$token = $body['csrf_token'] ?? null;
if ($token !== null && !validate_csrf_token($token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'CSRF token validation failed']);
    exit;
}

$receiver = isset($body['receiver_id']) ? trim((string)$body['receiver_id']) : '';
$contentRaw  = isset($body['content'])     ? trim((string)$body['content'])     : '';
$convIdParam = isset($body['conv_id']) ? (int)$body['conv_id'] : null;

if ($sender === '' || $receiver === '' || $contentRaw === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_fields']);
    exit;
}

// XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
// Note: SQL injection prevented by prepared statements
if (containsXSSPattern($contentRaw)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid characters in message']);
    exit;
}

$content = $contentRaw;

$len = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content); // mb_strlen counts Unicode chars
if ($len > 500) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'content_too_long',
        'max'     => 500,
        'length'  => $len
    ]);
    exit;
}

$senderId   = (int)$sender;
$receiverId = (int)$receiver;
$u1 = min($senderId, $receiverId);
$u2 = max($senderId, $receiverId);
$lockKey = "conv:$u1:$u2"; // used for advisory lock

$convId = null;
$msgId  = null;
/* will hold ISO-8601 UTC string, e.g., 2025-10-31T03:05:06Z */
$createdIso = null; // <-- will be filled after insert

try {
    $conn->begin_transaction();

    // Acquire advisory lock to avoid duplicate conversation rows under concurrency.
    $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS got_lock');
    $stmt->bind_param('s', $lockKey);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$res || (int)$res['got_lock'] !== 1) {
        throw new RuntimeException('Busy. Try again.');
    }

    // -------- Look up sender/receiver full names (used for messages AND conversation create) --------
    $stmt = $conn->prepare(
        'SELECT user_id, first_name, last_name
           FROM user_accounts
          WHERE user_id IN (?, ?)'
    );
    $stmt->bind_param('ii', $senderId, $receiverId);   // 'ii' = two integers
    $stmt->execute();
    $result = $stmt->get_result();

    // Fallbacks if anything is missing
    $senderName   = 'User ' . $senderId;
    $receiverName = 'User ' . $receiverId;

    while ($row = $result->fetch_assoc()) {
        // Build "First Last"; trim handles missing last names cleanly
        $full = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ((int)$row['user_id'] === $senderId) {
            $senderName = $full !== '' ? $full : $senderName;
        } elseif ((int)$row['user_id'] === $receiverId) {
            $receiverName = $full !== '' ? $full : $receiverName;
        }
    }
    $stmt->close();
    // Map names to the ordered pair (u1/u2) required by conversations table
    $u1Name = ($u1 === $senderId) ? $senderName  : $receiverName;
    $u2Name = ($u2 === $senderId) ? $senderName  : $receiverName;
    // -------- end name lookup --------

    // If conv_id is provided, validate it belongs to this user pair
    if ($convIdParam !== null && $convIdParam > 0) {
        $stmt = $conn->prepare('SELECT conv_id FROM conversations WHERE conv_id = ? AND user1_id = ? AND user2_id = ? LIMIT 1');
        $stmt->bind_param('iii', $convIdParam, $u1, $u2);
        $stmt->execute();
        $stmt->bind_result($convIdFound);
        if ($stmt->fetch()) {
            $convId = (int)$convIdFound;
        }
        $stmt->close();
        
        if ($convId === null) {
            // Invalid conv_id - doesn't belong to this user pair
            // Release lock before exiting
            $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
            $stmt->bind_param('s', $lockKey);
            $stmt->execute();
            $stmt->close();
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Invalid conversation ID']);
            exit;
        }
    } else {
        // Find existing conversation (NEW SCHEMA: user1_id/user2_id)
        // Note: This doesn't consider product_id, so it may pick the wrong conversation
        // if multiple chats exist with the same seller (different products)
        // This is kept for backward compatibility when conv_id is not provided
        $stmt = $conn->prepare('SELECT conv_id FROM conversations WHERE user1_id = ? AND user2_id = ? LIMIT 1');
        $stmt->bind_param('ii', $u1, $u2);
        $stmt->execute();
        $stmt->bind_result($convIdFound);
        if ($stmt->fetch()) {
            $convId = (int)$convIdFound;
        }
        $stmt->close();
    }

    // If not found, create it (must supply NOT NULL name columns)
    if ($convId === null) {
        $stmt = $conn->prepare(
            'INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname)
             VALUES (?, ?, ?, ?)'
        );
        // 'iiss' => two integers, two strings
        $stmt->bind_param('iiss', $u1, $u2, $u1Name, $u2Name);
        $stmt->execute();
        $convId = $conn->insert_id;
        $stmt->close();
    }

    // Check if conversation has item_deleted flag set
    $stmt = $conn->prepare('SELECT item_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    $stmt->bind_param('i', $convId);
    $stmt->execute();
    $stmt->bind_result($itemDeleted);
    $itemDeletedFlag = false;
    if ($stmt->fetch()) {
        $itemDeletedFlag = (bool)$itemDeleted;
    }
    $stmt->close();

    // If item is deleted, block message creation
    if ($itemDeletedFlag) {
        // Release lock before exiting
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->bind_param('s', $lockKey);
        $stmt->execute();
        $stmt->close();
        $conn->rollback();
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Item has been deleted. Cannot send messages.']);
        exit;
    }

    // Ensure both participants exist
    $stmt = $conn->prepare(
        'INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
         VALUES (?, ?, 0, 0), (?, ?, 0, 0)'
    );
    $stmt->bind_param('iiii', $convId, $u1, $convId, $u2);
    $stmt->execute();
    $stmt->close();

    // 🔄 Conversation is active again: clear deleted flags for BOTH participants
    $stmt = $conn->prepare(
        'UPDATE conversations
           SET user1_deleted = 0,
               user2_deleted = 0
         WHERE conv_id = ?'
    );
    $stmt->bind_param('i', $convId);
    $stmt->execute();
    $stmt->close();

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // All message data (content, names) is bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // This prevents SQL injection attacks even if malicious SQL code is in any field.
    // ============================================================================
    $stmt = $conn->prepare(
        'INSERT INTO messages
           (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    // 'iiisss' => 3 ints, 3 strings - all safely bound as parameters
    $stmt->bind_param('iiisss', $convId, $senderId, $receiverId, $senderName, $receiverName, $content);
    $stmt->execute();
    $msgId = $conn->insert_id;
    $stmt->close();

    /* Fetch the DB-assigned created_at in ISO-8601 UTC (matches your readers) */
    $stmt = $conn->prepare(
        'SELECT DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at
           FROM messages
          WHERE message_id = ?'
    );
    $stmt->bind_param('i', $msgId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $createdIso = $row ? (string)$row['created_at'] : null; // fallback handled below if null

    // Update receiver's unread counters
    $stmt = $conn->prepare(
        'UPDATE conversation_participants
           SET unread_count = unread_count + 1,
               first_unread_msg_id = CASE
                   WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ?
                   ELSE first_unread_msg_id
               END
         WHERE conv_id = ? AND user_id = ?'
    );
    $stmt->bind_param('iii', $msgId, $convId, $receiverId);
    $stmt->execute();
    $stmt->close();

    // Release advisory lock
    $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
    $stmt->bind_param('s', $lockKey);
    $stmt->execute();
    $stmt->close();

    $conn->commit();

    if ($createdIso === null) {
        // Very defensive fallback; should rarely trigger since we SELECTed above.
        $createdIso = gmdate('Y-m-d\TH:i:s\Z'); // UTC "now"
    }

    echo json_encode([
        'success'     => true,
        'conv_id'     => $convId,
        'message_id'  => $msgId,
        // Return the fields you asked for as a single object for the client
        'message'     => [
            'message_id' => $msgId,
            'content'    => $content,
            'created_at' => $createdIso, // ISO-8601 UTC, e.g., 2025-10-31T03:05:06Z
        ],
    ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    if ($conn->errno === 0) {
        $conn->rollback();
    }
    if ($lockKey) {
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        if ($stmt) {
            $stmt->bind_param('s', $lockKey);
            $stmt->execute();
            $stmt->close();
        }
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
