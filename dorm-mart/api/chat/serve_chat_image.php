<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with GET method and authentication
// Note: This endpoint serves images, not JSON, so we handle responses differently
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $conn->set_charset('utf8mb4');

    header('X-Content-Type-Options: nosniff');

    $messageId = isset($_GET['message_id']) ? (int)$_GET['message_id'] : 0;
    $forceDownload = isset($_GET['download']) && $_GET['download'] === '1';

    if ($messageId <= 0) {
        send_json_error(400, 'bad_message_id');
    }

    $sql = '
      SELECT m.image_url, m.conv_id, c.user1_id, c.user2_id
        FROM messages m
        JOIN conversations c ON c.conv_id = m.conv_id
       WHERE m.message_id = ?
       LIMIT 1
    ';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }
    $stmt->bind_param('i', $messageId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        send_json_error(404, 'not_found');
    }

    if ((int)$row['user1_id'] !== (int)$userId && (int)$row['user2_id'] !== (int)$userId) {
        send_json_error(403, 'forbidden');
    }

    $imageRel = (string)($row['image_url'] ?? '');
    if ($imageRel === '') {
        send_json_error(404, 'no_image');
    }

    require_once __DIR__ . '/../utility/env_config.php';
    $envDir = get_env_var('DATA_IMAGES_DIR');
    if (!$envDir) {
        send_json_error(500, 'Image storage configuration missing');
    }

    $mediaRoot = realpath($envDir . '/chat-images');
    if (!$mediaRoot) {
        send_json_error(404, 'file_missing');
    }

    $absPath = realpath($mediaRoot . '/' . basename($imageRel));
    if (!$absPath || strpos($absPath, $mediaRoot) !== 0 || !is_file($absPath)) {
        send_json_error(404, 'file_missing');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime  = $finfo->file($absPath) ?: 'application/octet-stream';

    if (strpos($mime, 'image/') !== 0) {
        send_json_error(415, 'unsupported_mime');
    }

    $basename = basename($absPath);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string)filesize($absPath));
    header('Cache-Control: private, max-age=604800');
    header('Content-Disposition: ' . ($forceDownload ? 'attachment' : 'inline') . '; filename="' . $basename . '"');

    readfile($absPath);
    exit;
} catch (Throwable $e) {
    error_log('serve_chat_image error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}
