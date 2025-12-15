<?php
// Include security utilities
require_once __DIR__ . '/../../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// __DIR__ points to api/
require __DIR__ . '/../../database/db_connect.php';

$conn = db();

$rows = [];

echo json_encode(['success' => true, 'data' => $rows]);
