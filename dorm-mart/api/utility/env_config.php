<?php
/**
 * Environment Configuration Helpers
 * 
 * Centralized functions for accessing environment variables.
 * Reads directly from .env files - no hardcoded fallbacks.
 * 
 * All configuration comes from .env files. If a variable isn't set,
 * functions will throw errors or use sensible defaults.
 */

declare(strict_types=1);

require_once __DIR__ . '/load_env.php';

// Ensure environment is loaded
load_env();

/**
 * Get the frontend base URL from environment
 * 
 * @return string Frontend base URL
 * @throws RuntimeException if FRONTEND_BASE_URL is not set
 */
function get_frontend_base_url(): string {
    $url = getenv('FRONTEND_BASE_URL');
    
    if (!$url || $url === '') {
        throw new RuntimeException('FRONTEND_BASE_URL is not set in .env file');
    }
    
    return rtrim($url, '/');
}

/**
 * Get the API base URL from environment
 * 
 * If API_BASE_URL is not set, derives it from FRONTEND_BASE_URL + /api
 * 
 * @return string API base URL
 */
function get_api_base_url(): string {
    $url = getenv('API_BASE_URL');
    
    if ($url && $url !== '') {
        return rtrim($url, '/');
    }
    
    // Derive from FRONTEND_BASE_URL if API_BASE_URL not set
    $frontendUrl = get_frontend_base_url();
    return rtrim($frontendUrl, '/') . '/api';
}

/**
 * Get allowed CORS origins from environment
 * 
 * If CORS_ALLOWED_ORIGINS is not set, defaults to FRONTEND_BASE_URL
 * 
 * @return array Array of allowed origin URLs
 */
function get_cors_allowed_origins(): array {
    $origins = getenv('CORS_ALLOWED_ORIGINS');
    
    if ($origins && $origins !== '') {
        // Parse comma-separated list
        $parsed = array_map('trim', explode(',', $origins));
        return array_filter($parsed, fn($o) => $o !== '');
    }
    
    // Default to FRONTEND_BASE_URL if CORS_ALLOWED_ORIGINS not set
    return [get_frontend_base_url()];
}

/**
 * Get environment name from environment variable
 * 
 * @return string Environment name (defaults to 'development' if not set)
 */
function get_environment(): string {
    $env = getenv('ENVIRONMENT');
    return $env ?: 'development';
}

/**
 * Get an environment variable value
 * 
 * @param string $key Environment variable name
 * @param string|null $default Default value if not set
 * @return string|null Environment variable value or default
 */
function get_env_var(string $key, ?string $default = null): ?string {
    $value = getenv($key);
    return ($value !== false && $value !== '') ? $value : $default;
}

