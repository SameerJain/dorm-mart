<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $userId = require_login();

    $file = extract_upload();
    if ($file === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Image file is required']);
        exit;
    }

    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Failed to upload profile photo']);
        exit;
    }

    if (!is_uploaded_file($file['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid upload source']);
        exit;
    }

    $sizeBytes = filesize($file['tmp_name']);
    $maxBytes  = 4 * 1024 * 1024; // 4 MB
    if ($sizeBytes !== false && $sizeBytes > $maxBytes) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Profile photo must be 4 MB or smaller']);
        exit;
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
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Unsupported image format']);
        exit;
    }

    $apiRoot      = dirname(__DIR__);          // /api
    $projectRoot  = dirname($apiRoot);         // project root
    $envDir       = getenv('DATA_IMAGES_DIR');
    $envBase      = getenv('DATA_IMAGES_URL_BASE');
    $imageDirFs   = rtrim($envDir !== false && $envDir !== '' ? $envDir : ($projectRoot . '/images'), '/') . '/';
    $imageBaseUrl = rtrim($envBase !== false && $envBase !== '' ? $envBase : '/images', '/');

    if (!is_dir($imageDirFs) && !@mkdir($imageDirFs, 0775, true) && !is_dir($imageDirFs)) {
        throw new RuntimeException('Unable to create images directory');
    }

    $filename   = sprintf('profile_%d_%s.%s', $userId, bin2hex(random_bytes(8)), $allowed[$mime]);
    $destPath   = $imageDirFs . $filename;
    $publicPath = $imageBaseUrl . '/' . $filename;

    if (!@move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Could not save uploaded photo']);
        exit;
    }

    echo json_encode([
        'success'   => true,
        'image_url' => $publicPath,
    ]);
} catch (Throwable $e) {
    error_log('upload_profile_photo.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
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
