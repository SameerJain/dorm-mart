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

// This endpoint expects multipart/form-data with an image file
$ctype = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ctype, 'multipart/form-data') !== 0) {
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => 'expected_multipart_formdata']);
    exit;
}

/* Read form fields (sent via FormData on the client) */
$receiver    = isset($_POST['receiver_id']) ? trim((string)$_POST['receiver_id']) : '';
$contentRaw  = isset($_POST['content'])     ? trim((string)$_POST['content'])     : ''; // optional caption
$convIdParam = isset($_POST['conv_id'])     ? (int)$_POST['conv_id']              : null;

/* Optional CSRF token support (if you include one in FormData) */
$token = $_POST['csrf_token'] ?? null;
if ($token !== null && !validate_csrf_token($token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'CSRF token validation failed']);
    exit;
}

/* Validate presence of receiver and the uploaded image.
   Caption (contentRaw) is allowed to be empty for image-only messages. */
if ($receiver === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_receiver']);
    exit;
}
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_image']);
    exit;
}

/* XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage */
if ($contentRaw !== '' && containsXSSPattern($contentRaw)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid characters in caption']);
    exit;
}
$content = $contentRaw;

/* Caption length guard (same policy as text messages) */
$len = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content);
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

/* --- Validate and store the uploaded image --- */
$MAX_BYTES = 2 * 1024 * 1024; // 5MB cap
if ((int)$_FILES['image']['size'] > $MAX_BYTES) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'image_too_large', 'max_bytes' => $MAX_BYTES]);
    exit;
}

/* Use fileinfo to determine the real MIME type of the temp file (prevents spoofing) */
$finfo = new finfo(FILEINFO_MIME_TYPE); // requires php-fileinfo extension
$mime  = $finfo->file($_FILES['image']['tmp_name']) ?: 'application/octet-stream';

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];
if (!isset($allowed[$mime])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'unsupported_image_type']);
    exit;
}
$ext = $allowed[$mime];

/* Build destination dir:
   - __DIR__ = api/chat
   - dirname(__DIR__, 2) goes up two levels to project root (dorm-mart/)
*/
$projectRoot = dirname(__DIR__, 2);
$destDir     = $projectRoot . '/media/chat-images';
if (!is_dir($destDir)) {
    if (!@mkdir($destDir, 0755, true) && !is_dir($destDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'media_dir_unwritable']);
        exit;
    }
}

/* Generate a unique filename to avoid collisions */
$senderId = (int)$sender;
$fname = sprintf(
    'u%s_%s_%s.%s',
    $senderId,
    gmdate('Ymd_His'),
    bin2hex(random_bytes(6)),  // random suffix
    $ext
);
$destPath = $destDir . '/' . $fname;

/* Move the uploaded temp file to the destination */
if (!@move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'image_save_failed']);
    exit;
}

/* Build the public relative URL path that your frontend can render.
   Assumes /media is web-accessible from the project root. */
$imageRelUrl = '/media/chat-images/' . $fname;

/* --- Conversation plumbing (same as create_message.php) --- */
$receiverId = (int)$receiver;
$u1 = min($senderId, $receiverId);
$u2 = max($senderId, $receiverId);
$lockKey = "conv:$u1:$u2";

$convId = null;
$msgId  = null;
/* will hold ISO-8601 UTC string, e.g., 2025-10-31T03:05:06Z */
$createdIso = null;

try {
    $conn->begin_transaction();

    // Acquire advisory lock
    $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS got_lock');
    $stmt->bind_param('s', $lockKey);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$res || (int)$res['got_lock'] !== 1) {
        throw new RuntimeException('Busy. Try again.');
    }

    // Look up sender/receiver names
    $stmt = $conn->prepare(
        'SELECT user_id, first_name, last_name
           FROM user_accounts
          WHERE user_id IN (?, ?)'
    );
    $stmt->bind_param('ii', $senderId, $receiverId);
    $stmt->execute();
    $result = $stmt->get_result();

    $senderName   = 'User ' . $senderId;     // fallbacks
    $receiverName = 'User ' . $receiverId;

    while ($row = $result->fetch_assoc()) {
        $full = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
        if ((int)$row['user_id'] === $senderId) {
            $senderName = $full !== '' ? $full : $senderName;
        } elseif ((int)$row['user_id'] === $receiverId) {
            $receiverName = $full !== '' ? $full : $receiverName;
        }
    }
    $stmt->close();

    $u1Name = ($u1 === $senderId) ? $senderName  : $receiverName;
    $u2Name = ($u2 === $senderId) ? $senderName  : $receiverName;

    // Validate/resolve conv_id
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
            $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
            $stmt->bind_param('s', $lockKey);
            $stmt->execute();
            $stmt->close();
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Invalid conversation ID']);
            exit;
        }
    } else {
        $stmt = $conn->prepare('SELECT conv_id FROM conversations WHERE user1_id = ? AND user2_id = ? LIMIT 1');
        $stmt->bind_param('ii', $u1, $u2);
        $stmt->execute();
        $stmt->bind_result($convIdFound);
        if ($stmt->fetch()) {
            $convId = (int)$convIdFound;
        }
        $stmt->close();
    }

    // Create conversation if missing
    if ($convId === null) {
        $stmt = $conn->prepare(
            'INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->bind_param('iiss', $u1, $u2, $u1Name, $u2Name);
        $stmt->execute();
        $convId = (int)$conn->insert_id;
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

    // If item is deleted, block image message creation
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

    // Ensure participants exist
    $stmt = $conn->prepare(
        'INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
         VALUES (?, ?, 0, 0), (?, ?, 0, 0)'
    );
    $stmt->bind_param('iiii', $convId, $u1, $convId, $u2);
    $stmt->execute();
    $stmt->close();

    /* Insert image message (assumes messages.image_url exists) */
    $stmt = $conn->prepare(
        'INSERT INTO messages
           (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('iiissss', $convId, $senderId, $receiverId, $senderName, $receiverName, $content, $imageRelUrl);
    $stmt->execute();
    $msgId = (int)$conn->insert_id;
    $stmt->close();

    // Fetch created_at in ISO-8601 UTC
    $stmt = $conn->prepare(
        'SELECT DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at
           FROM messages
          WHERE message_id = ?'
    );
    $stmt->bind_param('i', $msgId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $createdIso = $row ? (string)$row['created_at'] : null;

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
        $createdIso = gmdate('Y-m-d\TH:i:s\Z');
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    echo json_encode([
        'success'     => true,
        'conv_id'     => $convId,
        'message_id'  => $msgId,
        'message'     => [
            'message_id' => $msgId,
            'content'    => $content,       // caption (possibly empty string) - Note: No HTML encoding needed for JSON - React handles XSS protection
            'created_at' => $createdIso,    // ISO-8601 UTC
            'image_url'  => $imageRelUrl,   // relative public path
        ],
    ], JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    if ($conn->errno === 0) {
        $conn->rollback();
    }
    if (!empty($lockKey)) {
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
