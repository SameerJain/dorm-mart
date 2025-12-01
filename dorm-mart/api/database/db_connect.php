<?php

function db(): mysqli
{
    // Include security utilities for escapeHtml function
    $root = dirname(__DIR__, 2);
    require_once $root . '/api/security/security.php';
    
    require_once $root . '/api/utility/load_env.php';
    load_env();

    $servername = getenv('DB_HOST');
    $dbname     = getenv('DB_NAME');
    $username   = getenv('DB_USERNAME');
    $password   = getenv('DB_PASSWORD');

    // SQL INJECTION PROTECTION: Validate database name format (alphanumeric, underscore, hyphen only)
    // Database names from environment should be safe, but we validate to be extra cautious
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $dbname)) {
        die(json_encode(["success" => false, "message" => "Invalid database name format"]));
    }

    // db connection
    $conn = new mysqli($servername, $username, $password);

    // check if db connected successfully
    if ($conn->connect_error) {
        // XSS PROTECTION: Escape database connection error message to prevent XSS
        die(json_encode(["success" => false, "message" => "Connection failed: " . escapeHtml($conn->connect_error)]));
    }

    // SQL INJECTION PROTECTION: Escape database name for use in SQL queries
    // While $dbname comes from environment (not user input), we still escape it for safety
    // Use real_escape_string for string values in LIKE, and backticks for identifiers
    $dbnameEscaped = $conn->real_escape_string($dbname);
    $result = $conn->query("SHOW DATABASES LIKE '$dbnameEscaped'");
    if ($result && $result->num_rows === 0) {
        // db doesn't exist — create it
        // Use backticks for identifier escaping in CREATE DATABASE
        if (!$conn->query("CREATE DATABASE `$dbname`")) {
            // XSS PROTECTION: Escape database error message to prevent XSS
            die(json_encode(["success" => false, "message" => "Failed to create database: " . escapeHtml($conn->error)]));
        }
    }

    // select the database (using validated name - select_db() is a method, not SQL, so no escaping needed)
    $conn->select_db($dbname);
    
    // ensure autocommit is enabled
    $conn->autocommit(true);
    
    // set timezone to UTC for consistent token expiration handling
    date_default_timezone_set('UTC'); 
    $conn->query("SET time_zone = '+00:00'");

    return $conn;
}
