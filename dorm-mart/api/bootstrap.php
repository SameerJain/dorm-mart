<?php
/**
 * API Bootstrap Utilities
 * 
 * Provides standardized initialization and response handling for API endpoints.
 * Reduces code duplication across API files.
 */

declare(strict_types=1);

require_once __DIR__ . '/security/security.php';

/**
 * Send standardized JSON error response
 * 
 * @param int $code HTTP status code
 * @param string $message Error message
 * @param mixed $data Additional error data (optional)
 */
function send_json_error(int $code, string $message, $data = null): void {
    http_response_code($code);
    $response = ['success' => false, 'error' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response);
    exit;
}

/**
 * Send standardized JSON success response
 * 
 * @param mixed $data Response data (can be array with multiple keys or single value)
 * @param int $code HTTP status code (default: 200)
 */
function send_json_success($data, int $code = 200): void {
    http_response_code($code);
    $response = ['success' => true];
    
    if ($data !== null) {
        // If data is an associative array with multiple keys (not just 'data'), merge keys at top level
        if (is_array($data) && !isset($data['data']) && count($data) > 0) {
            // Check if it's an associative array (has string keys)
            $hasStringKeys = false;
            foreach (array_keys($data) as $key) {
                if (is_string($key)) {
                    $hasStringKeys = true;
                    break;
                }
            }
            
            if ($hasStringKeys) {
                // Merge keys at top level (e.g., ['count' => 5, 'reviews' => []] becomes top-level keys)
                foreach ($data as $key => $value) {
                    if ($key !== 'success') {
                        $response[$key] = $value;
                    }
                }
            } else {
                // Numeric array, wrap in 'data'
                $response['data'] = $data;
            }
        } elseif (is_array($data) && isset($data['data'])) {
            // If data already has 'data' key, merge it
            $response = array_merge($response, $data);
        } else {
            // Single value or null, wrap in 'data' key
            $response['data'] = $data;
        }
    }
    
    echo json_encode($response);
    exit;
}

/**
 * Parse JSON request body
 * 
 * @return array Parsed JSON data
 * @throws RuntimeException If JSON is invalid
 */
function parse_json_body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    
    if (!is_array($data)) {
        send_json_error(400, 'Invalid JSON format');
    }
    
    return $data;
}

/**
 * Get JSON request body or POST data
 * 
 * @return array Request data
 */
function get_request_data(): array {
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    
    if (strpos($contentType, 'application/json') !== false) {
        return parse_json_body();
    }
    
    return $_POST;
}

/**
 * Validate CSRF token if provided (optional validation)
 * Exits with 403 error if token is provided but invalid
 * 
 * @param array $input Request data array
 * @return void
 */
function validate_csrf_optional(array $input): void {
    require_once __DIR__ . '/auth/auth_handle.php';
    
    $token = $input['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        send_json_error(403, 'CSRF token validation failed');
    }
}

/**
 * Validate product ID from input array
 * Exits with 400 error if invalid
 * 
 * @param array $input Request data array
 * @param string $key Key name for product_id (default: 'product_id')
 * @return int Validated product ID
 */
function validate_product_id(array $input, string $key = 'product_id'): int {
    $productId = isset($input[$key]) ? (int)$input[$key] : 0;
    if ($productId <= 0) {
        send_json_error(400, 'Invalid product_id');
    }
    return $productId;
}

/**
 * Validate rating value from input array
 * Exits with 400 error if invalid
 * 
 * @param array $input Request data array
 * @param string $key Key name for rating (default: 'rating')
 * @param float $min Minimum rating value (default: 0)
 * @param float $max Maximum rating value (default: 5)
 * @param bool $requireHalfIncrements Whether to require 0.5 increments (default: true)
 * @return float Validated rating
 */
function validate_rating(array $input, string $key = 'rating', float $min = 0, float $max = 5, bool $requireHalfIncrements = true): float {
    if (!isset($input[$key])) {
        send_json_error(400, "Missing field: $key");
    }
    
    $rating = (float)$input[$key];
    
    if ($rating < $min || $rating > $max) {
        send_json_error(400, "Rating must be between $min and $max");
    }
    
    if ($requireHalfIncrements && fmod($rating * 2, 1) !== 0.0) {
        send_json_error(400, "Rating must be in 0.5 increments");
    }
    
    return $rating;
}

/**
 * Bootstrap API endpoint with security headers, CORS, and method validation
 * 
 * @param array|string $allowedMethods Allowed HTTP methods (e.g., ['GET', 'POST'] or 'GET')
 * @param bool $requireAuth Whether to require authentication (default: false)
 * @param bool $enforceHttps Whether to enforce HTTPS in production (default: false)
 * @return array|null Returns ['userId' => int, 'conn' => mysqli] if requireAuth=true, null otherwise
 */
function api_bootstrap($allowedMethods = ['GET', 'POST'], bool $requireAuth = false, bool $enforceHttps = false): ?array {
    // Set security headers and CORS
    setSecurityHeaders();
    setSecureCORS();
    
    // Set JSON content type
    header('Content-Type: application/json; charset=utf-8');
    
    // HTTPS enforcement for production (if requested)
    if ($enforceHttps) {
        // Load environment config if needed
        if (!function_exists('get_environment')) {
            require_once __DIR__ . '/utility/env_config.php';
        }
        
        // Only enforce HTTPS if not in development/local environment
        // Check if we're on localhost (development)
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $isLocalhost = (
            $host === 'localhost' ||
            $host === 'localhost:8080' ||
            strpos($host, '127.0.0.1') === 0
        );
        
        if (!$isLocalhost && (!isset($_SERVER['HTTPS']) || $_SERVER['HTTPS'] !== 'on')) {
            $httpsUrl = 'https://' . $host . ($_SERVER['REQUEST_URI'] ?? '');
            header("Location: $httpsUrl", true, 301);
            exit;
        }
    }
    
    // Handle CORS preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    
    // Normalize allowed methods to array
    if (is_string($allowedMethods)) {
        $allowedMethods = [$allowedMethods];
    }
    
    // Validate HTTP method
    $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($requestMethod, $allowedMethods, true)) {
        http_response_code(405);
        send_json_error(405, 'Method Not Allowed');
        exit;
    }
    
    // Handle authentication if required
    if ($requireAuth) {
        require_once __DIR__ . '/auth/auth_handle.php';
        require_once __DIR__ . '/database/db_connect.php';
        
        // Initialize session for authentication
        auth_boot_session();
        
        $userId = require_login(); // This will exit if not authenticated
        
        $conn = db();
        $conn->set_charset('utf8mb4');
        
        return ['userId' => $userId, 'conn' => $conn];
    }
    
    return null;
}

