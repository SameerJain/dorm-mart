<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $productId = validate_product_id($payload);

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

    send_json_success(['has_active' => $hasActive]);
} catch (Throwable $e) {
    error_log('scheduled-purchase check_active error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

