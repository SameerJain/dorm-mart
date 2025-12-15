<?php

declare(strict_types=1);

class DatabaseConnectionException extends RuntimeException {}

function db(): mysqli
{
    $root = dirname(__DIR__, 2);
    require_once $root . '/api/security/security.php';
    
    require_once $root . '/api/utility/load_env.php';
    load_env();

    require_once $root . '/api/utility/env_config.php';
    $servername = getenv('DB_HOST');
    $dbname = getenv('DB_NAME');
    $username = getenv('DB_USERNAME');
    $password = getenv('DB_PASSWORD');

    if (!$servername || !$dbname || !$username) {
        throw new DatabaseConnectionException('Missing required database environment variables');
    }

    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $dbname)) {
        throw new DatabaseConnectionException('Invalid database name format');
    }

    $conn = new mysqli($servername, $username, $password ?? '');

    if ($conn->connect_error) {
        error_log('Database connection failed: ' . $conn->connect_error);
        throw new DatabaseConnectionException('Database connection failed');
    }

    $dbnameEscaped = $conn->real_escape_string($dbname);
    $result = $conn->query("SHOW DATABASES LIKE '$dbnameEscaped'");
    if ($result && $result->num_rows === 0) {
        if (!$conn->query("CREATE DATABASE `$dbname`")) {
            error_log('Failed to create database: ' . $conn->error);
            throw new DatabaseConnectionException('Failed to create database');
        }
    }

    $conn->select_db($dbname);
    $conn->autocommit(true);
    date_default_timezone_set('UTC');
    
    if (!$conn->query("SET time_zone = '+00:00'")) {
        error_log('Failed to set timezone: ' . $conn->error);
    }

    return $conn;
}
