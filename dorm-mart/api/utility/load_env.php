<?php

function load_env(): void {
    // Check if we're on Railway (or similar platform) where env vars are set directly
    // Railway sets RAILWAY_ENVIRONMENT variable, and env vars are already available via getenv()
    if (getenv('RAILWAY_ENVIRONMENT') !== false || getenv('DB_HOST') !== false) {
        // Environment variables are already set by Railway/platform
        // No need to load from .env file
        return;
    }
    
    // dorm-mart/
    $root = dirname(__DIR__, 2);
    // load whichever exists
    $devEnvFile = "{$root}/.env.development";
    $localEnvFile = "{$root}/.env.local";
    $prodEnvFile = "{$root}/.env.production";
    $cattleEnvFile = "{$root}/.env.cattle";

    // load whichever exists
    //! the order matters here
    //! make sure only one env file exists on any server you upload the project
    if (file_exists($devEnvFile)) {
        $envFile = $devEnvFile;
    } elseif (file_exists($localEnvFile)) {
        $envFile = $localEnvFile;
    } elseif (file_exists($prodEnvFile)) {
        $envFile = $prodEnvFile;
    } elseif (file_exists($cattleEnvFile)) {
        $envFile = $cattleEnvFile;
    } else {
        echo json_encode(["success" => false, "message" => "load_env fails: No .env file found"]);
        exit;
    }

    // parse and set env file
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        // skipping comments or empty lines
        if ($line === '' || str_starts_with($line, '#')) continue;
        // parse kvs
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        putenv(trim($key) . '=' . trim($value));
    }
    
}