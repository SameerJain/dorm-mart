<?php

/**
 * Input Sanitization Module
 * 
 * Functions for sanitizing user input to prevent XSS attacks
 */

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



