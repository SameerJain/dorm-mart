<?php
declare(strict_types=1);

// dorm-mart/api/image.php
// Serves images that are stored under /images/ on disk
// Accepts either ?file=filename.png OR ?url=/images/filename.png

// Include security utilities
require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

$IMAGE_DIR = realpath(__DIR__ . '/../images');
if ($IMAGE_DIR === false) {
    http_response_code(500);
    exit('Image directory not found');
}

function stream_image(string $path): void {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime  = finfo_file($finfo, $path);
    finfo_close($finfo);

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

// 1) ?file=filename.png
if (isset($_GET['file']) && $_GET['file'] !== '') {
    $file = basename($_GET['file']);
    $path = $IMAGE_DIR . DIRECTORY_SEPARATOR . $file;
    if (!file_exists($path)) {
        http_response_code(404);
        exit('Image not found');
    }
    stream_image($path);
}

// 2) ?url=/data/images/filename.png OR /media/review-images/filename.jpg OR /media/chat-images/filename.jpg
if (isset($_GET['url']) && $_GET['url'] !== '') {
    $url = $_GET['url'];

    // strip query part if present
    $qpos = strpos($url, '?');
    if ($qpos !== false) {
        $url = substr($url, 0, $qpos);
    }

    $projectRoot = dirname(__DIR__);
    $path = null;

    // Handle /data/images/ paths (legacy)
    $prefix = '/data/images/';
    if (strpos($url, $prefix) === 0) {
        $file = substr($url, strlen($prefix));
        $file = basename($file);
        $path = $IMAGE_DIR . DIRECTORY_SEPARATOR . $file;
    }
    // Handle /media/review-images/ paths
    elseif (strpos($url, '/media/review-images/') === 0) {
        $file = substr($url, strlen('/media/review-images/'));
        $file = basename($file);
        $mediaPath = $projectRoot . '/media/review-images/' . $file;
        if (file_exists($mediaPath)) {
            $path = $mediaPath;
        }
    }
    // Handle /media/chat-images/ paths
    elseif (strpos($url, '/media/chat-images/') === 0) {
        $file = substr($url, strlen('/media/chat-images/'));
        $file = basename($file);
        $mediaPath = $projectRoot . '/media/chat-images/' . $file;
        if (file_exists($mediaPath)) {
            $path = $mediaPath;
        }
    }
    // Handle other /media/ paths
    elseif (strpos($url, '/media/') === 0) {
        $file = substr($url, strlen('/media/'));
        $mediaPath = $projectRoot . '/media/' . $file;
        if (file_exists($mediaPath)) {
            $path = $mediaPath;
        }
    }
    // Fallback: maybe someone passed just filename
    else {
        $file = basename($url);
        $path = $IMAGE_DIR . DIRECTORY_SEPARATOR . $file;
    }

    if ($path === null || !file_exists($path)) {
        http_response_code(404);
        exit('Image not found');
    }
    stream_image($path);
}

// if neither param present
http_response_code(400);
exit('Missing file or url');
