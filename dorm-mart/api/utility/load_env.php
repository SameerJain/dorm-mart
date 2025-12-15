<?php

/**
 * Load environment variables from .env file
 * 
 * Single source of truth for environment loading.
 * Prevents multiple loads and provides helpful error messages.
 * 
 * Priority order:
 * 1. .env.development
 * 2. .env.local
 * 3. .env.production
 * 4. .env.cattle
 * 
 * IMPORTANT: Only one .env file should exist per environment.
 */
function load_env(): void {
    static $loaded = false;
    
    // Prevent multiple loads
    if ($loaded) {
        return;
    }
    
    // dorm-mart/
    $root = dirname(__DIR__, 2);
    
    // Check for env files in priority order
    $envFiles = [
        "{$root}/.env.development",
        "{$root}/.env.local",
        "{$root}/.env.production",
        "{$root}/.env.cattle"
    ];
    
    $envFile = null;
    foreach ($envFiles as $file) {
        if (file_exists($file) && is_readable($file)) {
            $envFile = $file;
            break;
        }
    }
    
    if (!$envFile) {
        // Only exit if we're in a web context (not CLI)
        if (php_sapi_name() !== 'cli') {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                "success" => false,
                "message" => "Environment configuration error: No .env file found. Please create one of: .env.development, .env.local, .env.production, or .env.cattle"
            ]);
            exit;
        } else {
            // In CLI, just warn
            error_log("Warning: No .env file found. Searched for: " . implode(', ', $envFiles));
            return;
        }
    }
    
    // Parse and set env file
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        if (php_sapi_name() !== 'cli') {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                "success" => false,
                "message" => "Environment configuration error: Failed to read .env file"
            ]);
            exit;
        }
        return;
    }
    
    foreach ($lines as $line) {
        $line = trim($line);
        // Skip comments or empty lines
        if ($line === '' || str_starts_with($line, '#')) continue;
        
        // Parse key=value
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        $key = trim($key);
        $value = trim($value);
        
        // Remove quotes if present
        if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
            (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
            $value = substr($value, 1, -1);
        }
        
        if ($key !== '') {
            putenv("$key=$value");
        }
    }
    
    $loaded = true;
}