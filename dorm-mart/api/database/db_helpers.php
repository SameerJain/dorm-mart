<?php
/**
 * Database Connection Helpers
 * 
 * Provides convenient functions for common database connection patterns.
 */

declare(strict_types=1);

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/../auth/auth_handle.php';

/**
 * Get authenticated database connection with user ID
 * 
 * @return array ['conn' => mysqli, 'userId' => int]
 */
function get_authenticated_db(): array {
    auth_boot_session();
    $userId = require_login(); // This will exit if not authenticated
    
    $conn = db();
    $conn->set_charset('utf8mb4');
    
    return ['conn' => $conn, 'userId' => $userId];
}

/**
 * Get database connection with charset set
 * 
 * @return mysqli Database connection
 */
function get_db(): mysqli {
    $conn = db();
    $conn->set_charset('utf8mb4');
    return $conn;
}



