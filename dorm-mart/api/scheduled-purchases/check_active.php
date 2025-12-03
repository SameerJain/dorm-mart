<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $userId = require_login();

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;

    if ($productId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid product_id']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $checkStmt = $conn->prepare('
        SELECT COUNT(*) as cnt 
        FROM scheduled_purchase_requests 
        WHERE inventory_product_id = ? 
        AND status IN (\'pending\', \'accepted\')
    ');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare check query');
    }
    $checkStmt->bind_param('i', $productId);
    $checkStmt->execute();
    $checkRes = $checkStmt->get_result();
    $checkRow = $checkRes ? $checkRes->fetch_assoc() : null;
    $checkStmt->close();

    $hasActive = $checkRow && (int)$checkRow['cnt'] > 0;

    echo json_encode([
        'success' => true,
        'has_active' => $hasActive
    ]);
} catch (Throwable $e) {
    error_log('scheduled-purchase check_active error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

