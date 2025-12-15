<?php
/**
 * Database Query Helper Functions
 * 
 * Provides reusable functions for common database query patterns
 */

declare(strict_types=1);

/**
 * Execute SELECT query and return all results
 * 
 * @param mysqli $conn Database connection
 * @param string $sql SQL query with placeholders
 * @param string $types Parameter types (e.g., 'is' for int, string)
 * @param array $params Parameters to bind
 * @return array Array of result rows
 * @throws RuntimeException If query fails
 */
function execute_select_query(mysqli $conn, string $sql, string $types, array $params): array {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query: ' . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
    $stmt->close();
    
    return $rows;
}

/**
 * Execute SELECT query and return single row
 * 
 * @param mysqli $conn Database connection
 * @param string $sql SQL query with placeholders
 * @param string $types Parameter types
 * @param array $params Parameters to bind
 * @return array|null Single row or null if not found
 * @throws RuntimeException If query fails
 */
function execute_select_one(mysqli $conn, string $sql, string $types, array $params): ?array {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare query: ' . $conn->error);
    }
    
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    
    return $row;
}

/**
 * Execute INSERT query and return insert ID
 * 
 * @param mysqli $conn Database connection
 * @param string $sql SQL INSERT query with placeholders
 * @param string $types Parameter types
 * @param array $params Parameters to bind
 * @return int Insert ID
 * @throws RuntimeException If query fails
 */
function execute_insert_query(mysqli $conn, string $sql, string $types, array $params): int {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare insert: ' . $conn->error);
    }
    
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $insertId = $conn->insert_id;
    $stmt->close();
    
    return $insertId;
}

/**
 * Execute UPDATE query and return affected rows
 * 
 * @param mysqli $conn Database connection
 * @param string $sql SQL UPDATE query with placeholders
 * @param string $types Parameter types
 * @param array $params Parameters to bind
 * @return int Number of affected rows
 * @throws RuntimeException If query fails
 */
function execute_update_query(mysqli $conn, string $sql, string $types, array $params): int {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare update: ' . $conn->error);
    }
    
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    
    return $affected;
}

/**
 * Execute DELETE query and return affected rows
 * 
 * @param mysqli $conn Database connection
 * @param string $sql SQL DELETE query with placeholders
 * @param string $types Parameter types
 * @param array $params Parameters to bind
 * @return int Number of affected rows
 * @throws RuntimeException If query fails
 */
function execute_delete_query(mysqli $conn, string $sql, string $types, array $params): int {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare delete: ' . $conn->error);
    }
    
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();
    
    return $affected;
}



