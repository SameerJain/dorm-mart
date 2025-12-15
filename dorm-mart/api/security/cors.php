<?php

/**
 * CORS Configuration Module
 * 
 * Sets secure CORS headers for trusted origins only
 */

/**
 * Set secure CORS headers for trusted origins only
 * This prevents unauthorized cross-origin requests
 */
function setSecureCORS() {
    // Skip CORS for CLI requests
    if (php_sapi_name() === 'cli') {
        return;
    }
    
    // Load environment configuration if not already loaded
    if (!function_exists('get_cors_allowed_origins')) {
        require_once __DIR__ . '/../utility/env_config.php';
    }
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // Get allowed origins from environment configuration
    $allowedOrigins = get_cors_allowed_origins();
    
    // Check if origin is explicitly allowed
    $isAllowedOrigin = in_array($origin, $allowedOrigins);
    
    // Set CORS headers based on the request type
    if ($isAllowedOrigin && $origin !== '') {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
        header('Access-Control-Max-Age: 86400');
    } else {
        // Reject requests from untrusted origins
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Origin not allowed']);
        exit;
    }
}

