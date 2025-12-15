<?php

/**
 * Input Validation Module
 * 
 * Functions for validating user input and detecting attack patterns
 */

require_once __DIR__ . '/sanitization.php';

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
    
    // Filter: Detects common XSS attack patterns (e.g., <script>, javascript:, event handlers)
    // This provides first-layer defense before data reaches the database
    $xssPatterns = [
        '/<script/i',           // Script tags in any case
        '/javascript:/i',        // JavaScript: protocol
        '/onerror=/i',           // Event handlers: onerror
        '/onload=/i',            // Event handlers: onload
        '/onclick=/i',           // Event handlers: onclick
        '/onmouseover=/i',       // Event handlers: onmouseover
        '/onfocus=/i',            // Event handlers: onfocus
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

/**
 * Validate user access to prevent IDOR attacks
 * @param int $requestedUserId The user ID being requested
 * @param int $loggedInUserId The currently logged in user ID
 */
function validateUserAccess($requestedUserId, $loggedInUserId) {
    // IDOR Protection - Ensure user can only access their own data
    if ($requestedUserId != $loggedInUserId) {
        // Use bootstrap's send_json_error if available, otherwise fallback
        if (function_exists('send_json_error')) {
            send_json_error(403, 'Permission denied - cannot access other user data');
        } else {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'Permission denied - cannot access other user data']);
            exit;
        }
    }
}



