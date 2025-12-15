<?php
/**
 * Image Path Helper Functions
 * 
 * Centralized functions for handling image paths across the application
 */

/**
 * Normalize image path to standard format
 * Handles various input formats and converts to /images/ path format
 * 
 * @param string|null $path Image path (can be /images/, /data/images/, or just filename)
 * @return string Normalized path starting with /images/ or empty string if invalid
 */
function normalize_image_path(?string $path): string {
    if (empty($path) || !is_string($path)) {
        return '';
    }
    
    $trimmed = trim($path);
    if ($trimmed === '') {
        return '';
    }
    
    // If it's already a full URL (http/https), return as-is
    if (preg_match('#^https?://#i', $trimmed) || strpos($trimmed, 'data:') === 0) {
        return $trimmed;
    }
    
    // If it starts with /images/, return as-is
    if (strpos($trimmed, '/images/') === 0) {
        return $trimmed;
    }
    
    // If it starts with /data/images/ (legacy), convert to /images/
    if (strpos($trimmed, '/data/images/') === 0) {
        $filename = basename($trimmed);
        return '/images/' . $filename;
    }
    
    // If it's just a filename, prepend /images/
    if (strpos($trimmed, '/') === false) {
        return '/images/' . $trimmed;
    }
    
    // If it starts with / but not /images/, extract filename and use /images/
    if ($trimmed[0] === '/') {
        $filename = basename($trimmed);
        return '/images/' . $filename;
    }
    
    // Default: treat as filename and prepend /images/
    return '/images/' . $trimmed;
}

/**
 * Check if an image path should be proxied through image.php
 * 
 * @param string $path Image path
 * @return bool True if path should be proxied
 */
function should_proxy_image(string $path): bool {
    if (empty($path)) {
        return false;
    }
    
    // Proxy remote URLs
    if (preg_match('#^https?://#i', $path)) {
        return true;
    }
    
    // Proxy /images/ paths
    if (strpos($path, '/images/') === 0) {
        return true;
    }
    
    // Proxy /media/ paths
    if (strpos($path, '/media/') === 0) {
        return true;
    }
    
    return false;
}

