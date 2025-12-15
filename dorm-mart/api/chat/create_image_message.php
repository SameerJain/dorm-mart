<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../utility/env_config.php';
require_once __DIR__ . '/../database/db_connect.php';

// This endpoint expects multipart/form-data with an image file
$ctype = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ctype, 'multipart/form-data') !== 0) {
    api_bootstrap('POST', true); // Initialize headers/CORS before error response
    send_json_error(415, 'expected_multipart_formdata');
}

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $conn->set_charset('utf8mb4');

    $receiver    = isset($_POST['receiver_id']) ? trim((string)$_POST['receiver_id']) : '';
    $contentRaw  = isset($_POST['content'])     ? trim((string)$_POST['content'])     : '';
    $convIdParam = isset($_POST['conv_id'])     ? (int)$_POST['conv_id']              : null;

    $token = $_POST['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        send_json_error(403, 'CSRF token validation failed');
    }

    if ($receiver === '') {
        send_json_error(400, 'missing_receiver');
    }
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        send_json_error(400, 'missing_image');
    }

    if ($contentRaw !== '' && containsXSSPattern($contentRaw)) {
        send_json_error(400, 'Invalid characters in caption');
    }
    $content = $contentRaw;

    $len = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content);
    if ($len > 500) {
        send_json_error(400, 'content_too_long', ['max' => 500, 'length' => $len]);
    }

    $MAX_BYTES = 2 * 1024 * 1024;
    if ((int)$_FILES['image']['size'] > $MAX_BYTES) {
        send_json_error(400, 'image_too_large', ['max_bytes' => $MAX_BYTES]);
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($_FILES['image']['tmp_name']) ?: 'application/octet-stream';

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];
    if (!isset($allowed[$mime])) {
        send_json_error(400, 'unsupported_image_type');
    }
    $ext = $allowed[$mime];

    $envDir = get_env_var('DATA_IMAGES_DIR');
    $envBase = get_env_var('DATA_IMAGES_URL_BASE');
    if (!$envDir || !$envBase) {
        send_json_error(500, 'Image storage configuration missing');
    }

    $destDir = $envDir . '/chat-images';
    if (!is_dir($destDir)) {
        if (!@mkdir($destDir, 0755, true) && !is_dir($destDir)) {
            send_json_error(500, 'media_dir_unwritable');
        }
    }

    $senderId = (int)$userId;
    $fname = sprintf(
        'u%s_%s_%s.%s',
        $senderId,
        gmdate('Ymd_His'),
        bin2hex(random_bytes(6)),
        $ext
    );
    $destPath = $destDir . '/' . $fname;

    if (!@move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
        send_json_error(500, 'image_save_failed');
    }

    $imageRelUrl = $envBase . '/chat-images/' . $fname;

    $receiverId = (int)$receiver;
    $u1 = min($senderId, $receiverId);
    $u2 = max($senderId, $receiverId);
    $lockKey = "conv:$u1:$u2";

    $convId = null;
    $msgId  = null;
    $createdIso = null;

    $conn->begin_transaction();

    $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS got_lock');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare lock query');
    }
    $stmt->bind_param('s', $lockKey);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to acquire lock');
    }
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$res || (int)$res['got_lock'] !== 1) {
        throw new RuntimeException('Busy. Try again.');
    }

    $stmt = $conn->prepare(
        'SELECT user_id, first_name, last_name
           FROM user_accounts
          WHERE user_id IN (?, ?)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare name lookup');
    }
    $stmt->bind_param('ii', $senderId, $receiverId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to execute name lookup');
    }
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

    if ($convIdParam !== null && $convIdParam > 0) {
        $stmt = $conn->prepare('SELECT conv_id FROM conversations WHERE conv_id = ? AND user1_id = ? AND user2_id = ? LIMIT 1');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare conversation validation');
        }
        $stmt->bind_param('iii', $convIdParam, $u1, $u2);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Failed to execute conversation validation');
        }
        $stmt->bind_result($convIdFound);
        if ($stmt->fetch()) {
            $convId = (int)$convIdFound;
        }
        $stmt->close();

        if ($convId === null) {
            $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
            if ($stmt) {
                $stmt->bind_param('s', $lockKey);
                $stmt->execute();
                $stmt->close();
            }
            send_json_error(403, 'Invalid conversation ID');
        }
    } else {
        $stmt = $conn->prepare('SELECT conv_id FROM conversations WHERE user1_id = ? AND user2_id = ? LIMIT 1');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare conversation lookup');
        }
        $stmt->bind_param('ii', $u1, $u2);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Failed to execute conversation lookup');
        }
        $stmt->bind_result($convIdFound);
        if ($stmt->fetch()) {
            $convId = (int)$convIdFound;
        }
        $stmt->close();
    }

    if ($convId === null) {
        $stmt = $conn->prepare(
            'INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname)
             VALUES (?, ?, ?, ?)'
        );
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare conversation creation');
        }
        $stmt->bind_param('iiss', $u1, $u2, $u1Name, $u2Name);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Failed to create conversation');
        }
        $convId = (int)$conn->insert_id;
        $stmt->close();
    }

    $stmt = $conn->prepare('SELECT item_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare item deleted check');
    }
    $stmt->bind_param('i', $convId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to check item deleted status');
    }
    $stmt->bind_result($itemDeleted);
    $itemDeletedFlag = false;
    if ($stmt->fetch()) {
        $itemDeletedFlag = (bool)$itemDeleted;
    }
    $stmt->close();

    if ($itemDeletedFlag) {
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        if ($stmt) {
            $stmt->bind_param('s', $lockKey);
            $stmt->execute();
            $stmt->close();
        }
        $conn->rollback();
        send_json_error(403, 'Item has been deleted. Cannot send messages.');
    }

    $stmt = $conn->prepare(
        'INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
         VALUES (?, ?, 0, 0), (?, ?, 0, 0)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare participant insert');
    }
    $stmt->bind_param('iiii', $convId, $u1, $convId, $u2);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to insert participants');
    }
    $stmt->close();

    $stmt = $conn->prepare(
        'INSERT INTO messages
           (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare message insert');
    }
    $stmt->bind_param('iiissss', $convId, $senderId, $receiverId, $senderName, $receiverName, $content, $imageRelUrl);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to insert message');
    }
    $msgId = (int)$conn->insert_id;
    $stmt->close();

    $stmt = $conn->prepare(
        'SELECT DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at
           FROM messages
          WHERE message_id = ?'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare timestamp fetch');
    }
    $stmt->bind_param('i', $msgId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to fetch timestamp');
    }
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $createdIso = $row ? (string)$row['created_at'] : null;

    $stmt = $conn->prepare(
        'UPDATE conversation_participants
           SET unread_count = unread_count + 1,
               first_unread_msg_id = CASE
                   WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ?
                   ELSE first_unread_msg_id
               END
         WHERE conv_id = ? AND user_id = ?'
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare unread update');
    }
    $stmt->bind_param('iii', $msgId, $convId, $receiverId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to update unread count');
    }
    $stmt->close();

    $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
    if ($stmt) {
        $stmt->bind_param('s', $lockKey);
        $stmt->execute();
        $stmt->close();
    }

    $conn->commit();

    if ($createdIso === null) {
        $createdIso = gmdate('Y-m-d\TH:i:s\Z');
    }

    send_json_success([
        'conv_id'     => $convId,
        'message_id'  => $msgId,
        'message'     => [
            'message_id' => $msgId,
            'content'    => $content,
            'created_at' => $createdIso,
            'image_url'  => $imageRelUrl,
        ],
    ]);
} catch (Throwable $e) {
    if ($conn->errno === 0) {
        $conn->rollback();
    }
    if (isset($lockKey) && $lockKey) {
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        if ($stmt) {
            $stmt->bind_param('s', $lockKey);
            $stmt->execute();
            $stmt->close();
        }
    }
    error_log('create_image_message error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}
