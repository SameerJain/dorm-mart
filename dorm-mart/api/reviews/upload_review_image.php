<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with POST method and authentication
// Note: This endpoint uses multipart/form-data for file uploads
$result = api_bootstrap('POST', true);
$userId = $result['userId'];

$ctype = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ctype, 'multipart/form-data') !== 0) {
    send_json_error(415, 'expected_multipart_formdata');
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    send_json_error(400, 'missing_image');
}

$MAX_BYTES = 2 * 1024 * 1024;
if ((int)$_FILES['image']['size'] > $MAX_BYTES) {
    send_json_error(400, 'image_too_large', ['max_bytes' => $MAX_BYTES]);
}

// Use fileinfo to determine the real MIME type of the temp file (prevents spoofing)
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

$projectRoot = dirname(__DIR__, 2);
$destDir = $projectRoot . '/media/review-images';
if (!is_dir($destDir)) {
    if (!@mkdir($destDir, 0755, true) && !is_dir($destDir)) {
        send_json_error(500, 'media_dir_unwritable');
    }
}

$fname = sprintf(
    'review_u%s_%s_%s.%s',
    $userId,
    gmdate('Ymd_His'),
    bin2hex(random_bytes(6)),
    $ext
);
$destPath = $destDir . '/' . $fname;

if (!@move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
    send_json_error(500, 'image_save_failed');
}

$imageRelUrl = '/media/review-images/' . $fname;

send_json_success([
    'image_url' => $imageRelUrl,
]);

