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

auth_boot_session();

// Require a logged-in user
$userId = require_login();

// This endpoint expects multipart/form-data with an image file
$ctype = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ctype, 'multipart/form-data') !== 0) {
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => 'expected_multipart_formdata']);
    exit;
}

// Validate presence of the uploaded image
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'missing_image']);
    exit;
}

// Validate file size (2MB max per image)
$MAX_BYTES = 2 * 1024 * 1024;
if ((int)$_FILES['image']['size'] > $MAX_BYTES) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'image_too_large', 'max_bytes' => $MAX_BYTES]);
    exit;
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
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'unsupported_image_type']);
    exit;
}
$ext = $allowed[$mime];

// Build destination directory
$projectRoot = dirname(__DIR__, 2);
$destDir     = $projectRoot . '/media/review-images';
if (!is_dir($destDir)) {
    if (!@mkdir($destDir, 0755, true) && !is_dir($destDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'media_dir_unwritable']);
        exit;
    }
}

// Generate a unique filename to avoid collisions
$fname = sprintf(
    'review_u%s_%s_%s.%s',
    $userId,
    gmdate('Ymd_His'),
    bin2hex(random_bytes(6)),  // random suffix
    $ext
);
$destPath = $destDir . '/' . $fname;

// Move the uploaded temp file to the destination
if (!@move_uploaded_file($_FILES['image']['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'image_save_failed']);
    exit;
}

// Build the public relative URL path that the frontend can use
$imageRelUrl = '/media/review-images/' . $fname;

echo json_encode([
    'success'   => true,
    'image_url' => $imageRelUrl,
], JSON_UNESCAPED_SLASHES);

