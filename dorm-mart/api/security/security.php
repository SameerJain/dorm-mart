<?php
/**
 * Comprehensive Security Module
 * This file contains all security-related functions for the application
 * 
 * @author Team f25-no-brainers
 * @version 1.0
 */

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Set comprehensive security headers for all API endpoints
 * This function should be called at the start of every API endpoint
 */
function setSecurityHeaders() {
    // Content Security Policy - Prevents XSS by controlling resource loading
    // Restricts which resources can be loaded and executed
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';");
    
    // X-XSS-Protection - Enables browser's built-in XSS filter
    header("X-XSS-Protection: 1; mode=block");
    
    // X-Content-Type-Options - Prevents MIME type sniffing
    header("X-Content-Type-Options: nosniff");
    
    // X-Frame-Options - Prevents clickjacking
    header("X-Frame-Options: DENY");
    
    // Referrer Policy - Controls referrer information
    header("Referrer-Policy: strict-origin-when-cross-origin");
    
    // Permissions Policy - Controls browser features
    header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
    
    // Remove X-Powered-By header to hide PHP version
    header_remove('X-Powered-By');
}

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

/**
 * Set secure CORS headers for trusted origins only
 * This prevents unauthorized cross-origin requests
 */
function setSecureCORS() {
    // Skip CORS for CLI requests
    if (php_sapi_name() === 'cli') {
        return;
    }
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    
    // SECURE CORS Configuration - Only allow specific trusted origins
    $allowedOrigins = [
        'http://localhost:3000',      // React dev server
        'http://localhost:8080',      // PHP dev server  
        'http://localhost',           // Apache local setup
        'https://aptitude.cse.buffalo.edu',  // Test server
        'https://cattle.cse.buffalo.edu'    // Production server
    ];
    
    // Check if this is a localhost request
    $isLocalhost = (
        $host === 'localhost' ||
        $host === 'localhost:8080' ||
        strpos($host, '127.0.0.1') === 0
    );
    
    // Check if this is a production server request
    $isProductionServer = (
        $host === 'aptitude.cse.buffalo.edu' ||
        $host === 'cattle.cse.buffalo.edu'
    );
    
    // Check if origin is explicitly allowed
    $isAllowedOrigin = in_array($origin, $allowedOrigins);
    
    // Set CORS headers based on the request type
    if ($isLocalhost) {
        // Localhost development - allow specific origins with credentials
        if ($isAllowedOrigin) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
        } else {
            // Fallback for localhost requests without origin header
            header("Access-Control-Allow-Origin: http://localhost:3000");
            header('Access-Control-Allow-Credentials: true');
        }
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
        header('Access-Control-Max-Age: 86400');
    } elseif ($isProductionServer) {
        // Production servers - allow same domain and specific origins
        if ($isAllowedOrigin) {
            header("Access-Control-Allow-Origin: $origin");
        } else {
            // Allow same domain requests
            header("Access-Control-Allow-Origin: https://$host");
        }
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
        header('Access-Control-Max-Age: 86400');
    } elseif ($isAllowedOrigin) {
        // Explicitly allowed origin
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

// ============================================================================
// INPUT SANITIZATION & VALIDATION
// ============================================================================

/**
 * Sanitize string input to prevent XSS attacks
 * @param string $input The input string to sanitize
 * @param int $maxLength Maximum allowed length (default: 1000)
 * @return string Sanitized string
 */
function sanitize_string($input, $maxLength = 1000) {
    if (!is_string($input)) {
        return '';
    }
    
    // Trim whitespace
    $input = trim($input);
    
    // Limit length
    $input = substr($input, 0, $maxLength);
    
    // Remove null bytes
    $input = str_replace("\0", '', $input);
    
    // XSS PROTECTION: HTML encode special characters to prevent XSS attacks
    $input = htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    
    return $input;
}

/**
 * Sanitize email input
 * @param string $email Email to sanitize
 * @return string Sanitized email
 */
function sanitize_email($email) {
    if (!is_string($email)) {
        return '';
    }
    
    // Convert to lowercase and trim
    $email = strtolower(trim($email));
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return '';
    }
    
    // Additional sanitization
    $email = sanitize_string($email, 254); // RFC 5321 limit
    
    return $email;
}

/**
 * Sanitize JSON input
 * @param string $json JSON string to sanitize
 * @return array|false Sanitized array or false if invalid
 */
function sanitize_json($json) {
    if (!is_string($json)) {
        return false;
    }
    
    // Decode JSON
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return false;
    }
    
    // Recursively sanitize all string values
    $data = sanitize_array($data);
    
    return $data;
}

/**
 * Recursively sanitize array values
 * @param array $data Array to sanitize
 * @return array Sanitized array
 */
function sanitize_array($data) {
    if (!is_array($data)) {
        return (array) sanitize_string($data);
    }
    
    $sanitized = [];
    foreach ($data as $key => $value) {
        $sanitizedKey = sanitize_string($key, 100);
        $sanitizedValue = is_array($value) ? sanitize_array($value) : sanitize_string($value);
        $sanitized[$sanitizedKey] = $sanitizedValue;
    }
    
    return $sanitized;
}

/**
 * Sanitize number input with min/max validation
 * @param mixed $input The input to sanitize
 * @param int $min Minimum allowed value
 * @param int $max Maximum allowed value
 * @return int Sanitized number
 */
function sanitize_number($input, $min = 0, $max = PHP_INT_MAX) {
    $number = (int) $input;
    return max($min, min($max, $number));
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

/**
 * Validate user access to prevent IDOR attacks
 * @param int $requestedUserId The user ID being requested
 * @param int $loggedInUserId The currently logged in user ID
 */
function validateUserAccess($requestedUserId, $loggedInUserId) {
    // IDOR Protection - Ensure user can only access their own data
    if ($requestedUserId != $loggedInUserId) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Permission denied - cannot access other user data']);
        exit;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape HTML output to prevent XSS using HTML entity encoding
 * 
 * Encoding is more foolproof than filtering - converts <script> to &lt;script&gt;
 * Use for HTML email templates and server-rendered HTML (not JSON APIs - React handles those)
 * 
 * @param string $str String to escape
 * @return string Escaped string with HTML entities
 */
function escapeHtml($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Escape JSON output to prevent XSS
 * @param string $str String to escape
 * @return string Escaped JSON string
 */
function escapeJson($str) {
    // XSS PROTECTION: JSON encode with hex encoding to prevent XSS attacks
    return json_encode($str ?? '', JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
}

/**
 * Validate input with custom rules
 * @param string $input Input to validate
 * @param int $maxLength Maximum length allowed
 * @param string|null $allowedChars Regex pattern for allowed characters
 * @return string|false Validated input or false if invalid
 */
function validateInput($input, $maxLength = 255, $allowedChars = null) {
    $input = trim($input);
    if (strlen($input) > $maxLength) {
        return false;
    }
    if ($allowedChars && !preg_match($allowedChars, $input)) {
        return false;
    }
    return $input;
}

/**
 * Check if input contains XSS attack patterns (first layer defense)
 * 
 * Filtering provides early detection, but encoding is more foolproof for output.
 * Use before database storage; combine with encoding for complete protection.
 * 
 * @param string $input Input to check
 * @return bool True if XSS pattern detected, false otherwise
 */
function containsXSSPattern($input) {
    if (!is_string($input)) {
        return false;
    }
    
    // Common XSS attack patterns to detect
    $xssPatterns = [
        '/<script/i',           // Script tags in any case
        '/javascript:/i',        // JavaScript: protocol
        '/onerror=/i',           // Event handlers: onerror
        '/onload=/i',            // Event handlers: onload
        '/onclick=/i',           // Event handlers: onclick
        '/onmouseover=/i',       // Event handlers: onmouseover
        '/<iframe/i',           // iframe tags
        '/<object/i',            // object tags
        '/<embed/i',             // embed tags
        '/<img[^>]*on/i',        // img tags with event handlers
        '/<svg[^>]*on/i',        // svg tags with event handlers
        '/expression\s*\(/i',   // CSS expression()
        '/vbscript:/i'           // VBScript protocol
    ];
    
    foreach ($xssPatterns as $pattern) {
        if (preg_match($pattern, $input)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if input contains SQL injection attack patterns
 * @param string $input Input to check
 * @return bool True if SQL injection pattern detected
 */
function containsSQLInjectionPattern($input) {
    if (!is_string($input)) {
        return false;
    }
    
    $sqlPatterns = [
        '/;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)/i',
        '/\'\s*;\s*--/',
        '/\/\*/',
        '/UNION\s+SELECT/i',
        '/OR\s+1\s*=\s*1/i',
        '/OR\s+\'1\'\s*=\s*\'1\'/i',
        '/\'\s+OR\s+\'\'/i',
        '/\'\s+OR\s+1\s*=/i'
    ];
    
    foreach ($sqlPatterns as $pattern) {
        if (preg_match($pattern, $input)) {
            return true;
        }
    }
    
    return false;
}

// ============================================================================
// RATE LIMITING FUNCTIONS
// ============================================================================

/**
 * Check if session has exceeded rate limit for login attempts
 * @param string $sessionId PHP session ID (PHPSESSID)
 * @return array Rate limit status
 */
function check_rate_limit($sessionId, $maxAttempts = 4, $lockoutMinutes = 3) {
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        
        $conn = db();
        if (!$conn) {
            return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
        }
    
    // Get current attempt count, last attempt time, and lockout status
    // SQL INJECTION PROTECTION: Using prepared statement with parameter binding to prevent SQL injection attacks
    $stmt = $conn->prepare("
        SELECT failed_login_attempts, last_failed_attempt, lockout_until 
        FROM login_rate_limits 
        WHERE session_id = ? 
        LIMIT 1
    ");
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
    }
    
    $row = $result->fetch_assoc();
    $stmt->close();
    
    $attempts = (int)$row['failed_login_attempts'];
    $lastAttempt = $row['last_failed_attempt'];
    $lockoutUntil = $row['lockout_until'];
    
    // Check if session is currently locked out FIRST (before decay)
    // If locked out, do NOT apply decay - lockout time must expire completely
    if ($lockoutUntil) {
        $currentTime = time();
        $lockoutExpiry = strtotime($lockoutUntil);
        
        if ($currentTime >= $lockoutExpiry) {
            // Lockout has expired, clear it AND reset attempts
            $updateStmt = $conn->prepare('UPDATE login_rate_limits SET lockout_until = NULL, failed_login_attempts = 0, last_failed_attempt = NULL WHERE session_id = ?');
            $updateStmt->bind_param('s', $sessionId);
            $updateStmt->execute();
            $updateStmt->close();
            $conn->close();
            return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
        }
        
        // Still locked out - return immediately without applying decay
        $conn->close();
        return ['blocked' => true, 'attempts' => $attempts, 'lockout_until' => $lockoutUntil];
    }
    
    // If no attempts, not blocked
    if ($attempts === 0) {
        $conn->close();
        return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
    }
    
    // DECAY SYSTEM: Reduce attempts by 1 if 10+ seconds have passed since last attempt
    // Only apply decay when NOT locked out
    $decaySeconds = 10;
    $currentTime = time();
    $lastAttemptTime = $lastAttempt ? strtotime($lastAttempt) : 0;
    $timeSinceLastAttempt = $currentTime - $lastAttemptTime;
    
    // Apply decay: if 10+ seconds have passed, reduce by exactly 1 (not by time elapsed)
    if ($timeSinceLastAttempt >= $decaySeconds && $attempts > 0) {
        $newAttempts = max(0, $attempts - 1);
        
        // Update attempts if they've decayed
        if ($newAttempts !== $attempts) {
            $updateStmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = ? WHERE session_id = ?');
            $updateStmt->bind_param('is', $newAttempts, $sessionId);
            $updateStmt->execute();
            $updateStmt->close();
            $attempts = $newAttempts;
        }
    }
    
    // Check if we need to start a new lockout (4+ attempts)
    if ($attempts >= $maxAttempts) {
        $currentTime = time();
        $lockoutExpiry = $currentTime + ($lockoutMinutes * 60);
        $lockoutUntil = date('Y-m-d H:i:s', $lockoutExpiry);
        
        // Set lockout timestamp
        $updateStmt = $conn->prepare('UPDATE login_rate_limits SET lockout_until = ? WHERE session_id = ?');
        $updateStmt->bind_param('ss', $lockoutUntil, $sessionId);
        $updateStmt->execute();
        $updateStmt->close();
        
        $conn->close();
        return ['blocked' => true, 'attempts' => $attempts, 'lockout_until' => $lockoutUntil];
    }
    
    // Don't clear timestamps here - let them persist for lockout tracking
    
    $conn->close();
    return ['blocked' => false, 'attempts' => $attempts, 'lockout_until' => null];
    } catch (Exception $e) {
        // If any error occurs, don't block the user
        return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
    }
}

/**
 * Record a failed login attempt for rate limiting
 * @param string $sessionId PHP session ID (PHPSESSID)
 */
function record_failed_attempt($sessionId) {
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        
        $conn = db();
        if (!$conn) {
            return; // Silently fail if no database connection
        }
    
    // First check if session record exists and get current attempt data
    // SQL INJECTION PROTECTION: Using prepared statement with parameter binding to prevent SQL injection attacks
    $checkStmt = $conn->prepare('SELECT failed_login_attempts, last_failed_attempt FROM login_rate_limits WHERE session_id = ?');
    $checkStmt->bind_param('s', $sessionId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $checkStmt->close();
    
    if ($result->num_rows > 0) {
        // Session record exists, get current data
        $row = $result->fetch_assoc();
        $currentAttempts = (int)$row['failed_login_attempts'];
        
        // Don't apply decay when recording new attempts - only when checking rate limits
        // This ensures that new attempts are always recorded regardless of time gaps
        
        // Now increment by 1
        $newAttempts = $currentAttempts + 1;
        // SQL INJECTION PROTECTION: Using prepared statement with parameter binding to prevent SQL injection attacks
        $stmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = ?, last_failed_attempt = NOW() WHERE session_id = ?');
        $stmt->bind_param('is', $newAttempts, $sessionId);
        $stmt->execute();
        $stmt->close();
        
        // Ensure the update is committed
        $conn->commit();
    } else {
        // Session record doesn't exist, create a new record for rate limiting
        // SQL INJECTION PROTECTION: Using prepared statement with parameter binding to prevent SQL injection attacks
        $stmt = $conn->prepare('INSERT INTO login_rate_limits (session_id, failed_login_attempts, last_failed_attempt) VALUES (?, 1, NOW())');
        $stmt->bind_param('s', $sessionId);
        $stmt->execute();
        $stmt->close();
        
        // Ensure the insert is committed
        $conn->commit();
    }
    
    $conn->close();
    } catch (Exception $e) {
        // Silently fail if any error occurs
        return;
    }
}

/**
 * Reset failed login attempts for a session
 * @param string $sessionId PHP session ID (PHPSESSID)
 */
function reset_failed_attempts($sessionId) {
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $stmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = 0, last_failed_attempt = NULL, lockout_until = NULL WHERE session_id = ?');
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $stmt->close();
    $conn->close();
}


/**
 * Get remaining lockout minutes
 * @param string $lockoutUntil Lockout end time
 * @return int Remaining minutes
 */
function get_remaining_lockout_minutes($lockoutUntil) {
    if (empty($lockoutUntil)) {
        return 0;
    }
    
    // Use MySQL to calculate remaining time to avoid timezone issues
    require_once __DIR__ . '/../database/db_connect.php';
    $conn = db();
    $stmt = $conn->prepare("SELECT TIMESTAMPDIFF(SECOND, NOW(), ?) as remaining_seconds");
    $stmt->bind_param('s', $lockoutUntil);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    $remainingSeconds = (int)$row['remaining_seconds'];
    return max(0, ceil($remainingSeconds / 60));
}

/**
 * Reset all lockouts (admin function)
 * Resets all session-based rate limiting lockouts
 */
function reset_all_lockouts() {
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $stmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = 0, last_failed_attempt = NULL, lockout_until = NULL');
    $stmt->execute();
    $stmt->close();
    $conn->close();
}

// ============================================================================
// PASSWORD SECURITY
// ============================================================================

/**
 * Hash password securely using bcrypt
 * @param string $password Plain text password
 * @return string Hashed password
 */
function hash_password($password) {
    require_once __DIR__ . '/../utility/hash_password.php';
    return password_hash($password, PASSWORD_BCRYPT);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize security for API endpoints
 * Call this function at the start of every API endpoint
 */
function initSecurity() {
    setSecurityHeaders();
    setSecureCORS();
}

?>