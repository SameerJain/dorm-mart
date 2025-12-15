<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../utility/env_config.php';

// Bootstrap API with POST method and authentication
// Note: This endpoint uses multipart/form-data for file uploads
$result = api_bootstrap('POST', true);
$userId = $result['userId'];

try {
    $file = extract_upload();
    if ($file === null) {
        send_json_error(400, 'Image file is required');
    }

    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        send_json_error(400, 'Failed to upload profile photo');
    }

    if (!is_uploaded_file($file['tmp_name'])) {
        send_json_error(400, 'Invalid upload source');
    }

    $sizeBytes = filesize($file['tmp_name']);
    $maxBytes = 4 * 1024 * 1024;
    if ($sizeBytes !== false && $sizeBytes > $maxBytes) {
        send_json_error(400, 'Profile photo must be 4 MB or smaller');
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = $finfo ? finfo_file($finfo, $file['tmp_name']) : null;
    if ($finfo) {
        finfo_close($finfo);
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];
    if (!isset($allowed[$mime ?? ''])) {
        send_json_error(400, 'Unsupported image format');
    }

    $apiRoot = dirname(__DIR__);
    $projectRoot = dirname($apiRoot);
    $envDir = get_env_var('DATA_IMAGES_DIR');
    $envBase = get_env_var('DATA_IMAGES_URL_BASE');
    $imageDirFs = rtrim($envDir ?: ($projectRoot . '/images'), '/') . '/';
    $imageBaseUrl = rtrim($envBase ?: '/images', '/');

    if (!is_dir($imageDirFs) && !@mkdir($imageDirFs, 0775, true) && !is_dir($imageDirFs)) {
        send_json_error(500, 'Unable to create images directory');
    }

    $filename = sprintf('profile_%d_%s.%s', $userId, bin2hex(random_bytes(8)), $allowed[$mime]);
    $destPath = $imageDirFs . $filename;
    $publicPath = $imageBaseUrl . '/' . $filename;

    if (!@move_uploaded_file($file['tmp_name'], $destPath)) {
        send_json_error(500, 'Could not save uploaded photo');
    }

    send_json_success([
        'image_url' => $publicPath,
    ]);
} catch (Throwable $e) {
    error_log('upload_profile_photo.php error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}

function extract_upload(): ?array
{
    $candidates = ['photo', 'avatar', 'image', 'file'];
    foreach ($candidates as $key) {
        if (!empty($_FILES[$key]) && is_array($_FILES[$key])) {
            return $_FILES[$key];
        }
    }
    if (!empty($_FILES)) {
        $file = reset($_FILES);
        if (is_array($file)) {
            return $file;
        }
    }
    return null;
}
