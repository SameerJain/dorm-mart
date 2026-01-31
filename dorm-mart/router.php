<?php
/**
 * Router for Railway deployment
 * Routes API requests to PHP files, serves React SPA for all other routes
 */

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Route API requests to PHP files
if (strpos($requestPath, '/api/') === 0) {
    // Remove /api prefix and route to actual PHP file
    $apiPath = substr($requestPath, 5); // Remove '/api/'
    
    // Remove query string for routing
    $apiPath = strtok($apiPath, '?');
    
    // Build full path to API file
    $apiFile = __DIR__ . '/api/' . $apiPath;
    
    // If it's a directory, try index.php
    if (is_dir($apiFile)) {
        $apiFile .= '/index.php';
    }
    
    // If file doesn't exist, try adding .php extension
    if (!file_exists($apiFile) && !is_dir($apiFile)) {
        $apiFile = __DIR__ . '/api/' . $apiPath . '.php';
    }
    
    // If API file exists, include it
    if (file_exists($apiFile) && is_file($apiFile)) {
        require $apiFile;
        exit;
    }
    
    // API file not found
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'API endpoint not found']);
    exit;
}

// Serve static files from build directory
$buildPath = __DIR__ . '/build' . $requestPath;

// If requesting root, serve index.html
if ($requestPath === '/' || $requestPath === '') {
    $buildPath = __DIR__ . '/build/index.html';
}

// If file exists in build directory, serve it
if (file_exists($buildPath) && is_file($buildPath)) {
    // Set appropriate content type
    $ext = pathinfo($buildPath, PATHINFO_EXTENSION);
    $mimeTypes = [
        'html' => 'text/html',
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'webp' => 'image/webp'
    ];
    
    $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $contentType);
    
    readfile($buildPath);
    exit;
}

// For React Router (SPA), serve index.html for all non-API routes
$indexPath = __DIR__ . '/build/index.html';
if (file_exists($indexPath)) {
    header('Content-Type: text/html');
    readfile($indexPath);
    exit;
}

// Fallback 404
http_response_code(404);
echo '404 Not Found';
