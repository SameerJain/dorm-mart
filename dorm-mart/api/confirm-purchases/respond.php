<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/helpers.php';

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
    $buyerId = require_login();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $confirmRequestId = isset($payload['confirm_request_id']) ? (int)$payload['confirm_request_id'] : 0;
    $action = isset($payload['action']) ? strtolower(trim((string)$payload['action'])) : '';

    if ($confirmRequestId <= 0 || ($action !== 'accept' && $action !== 'decline')) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid request']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectStmt = $conn->prepare('
        SELECT cpr.*, inv.title AS item_title
        FROM confirm_purchase_requests cpr
        INNER JOIN INVENTORY inv ON inv.product_id = cpr.inventory_product_id
        WHERE cpr.confirm_request_id = ?
        LIMIT 1
    ');
    if (!$selectStmt) {
        throw new RuntimeException('Failed to prepare confirm lookup');
    }
    $selectStmt->bind_param('i', $confirmRequestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $selectStmt->close();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Confirmation not found']);
        exit;
    }

    if ((int)$row['buyer_user_id'] !== $buyerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You are not allowed to respond to this confirmation']);
        exit;
    }

    $row = auto_finalize_confirm_request($conn, $row) ?? $row;
    if (($row['status'] ?? '') !== 'pending') {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'This confirmation has already been processed']);
        exit;
    }

    $nextStatus = $action === 'accept' ? 'buyer_accepted' : 'buyer_declined';
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $updateStmt = $conn->prepare('UPDATE confirm_purchase_requests SET status = ?, buyer_response_at = NOW() WHERE confirm_request_id = ? AND status = \'pending\' LIMIT 1');
    if (!$updateStmt) {
        throw new RuntimeException('Failed to prepare confirm update');
    }
    $updateStmt->bind_param('si', $nextStatus, $confirmRequestId);
    $updateStmt->execute();
    $affected = $updateStmt->affected_rows;
    $updateStmt->close();

    if ($affected === 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Confirmation status already updated']);
        exit;
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $selectStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE confirm_request_id = ? LIMIT 1');
    $selectStmt->bind_param('i', $confirmRequestId);
    $selectStmt->execute();
    $res = $selectStmt->get_result();
    $row = $res ? $res->fetch_assoc() : $row;
    $selectStmt->close();

    $conversationId = (int)$row['conversation_id'];
    $sellerId = (int)$row['seller_user_id'];
    $metadataType = $action === 'accept' ? 'confirm_accepted' : 'confirm_denied';
    $metadata = build_confirm_response_metadata($row, $metadataType);

    $names = get_user_display_names($conn, [$buyerId, $sellerId]);
    $buyerName = $names[$buyerId] ?? ('User ' . $buyerId);
    $content = $action === 'accept'
        ? $buyerName . ' accepted the Confirm Purchase form.'
        : $buyerName . ' denied the Confirm Purchase form.';

    insert_confirm_chat_message($conn, $conversationId, $buyerId, $sellerId, $content, $metadata);

    if ($action === 'accept') {
        mark_inventory_as_sold($conn, $row);
        record_purchase_history($conn, $buyerId, (int)$row['inventory_product_id'], [
            'confirm_request_id' => $confirmRequestId,
            'is_successful' => (bool)$row['is_successful'],
            'final_price' => $row['final_price'] !== null ? (float)$row['final_price'] : null,
            'failure_reason' => $row['failure_reason'],
            'seller_notes' => $row['seller_notes'],
            'failure_reason_notes' => $row['failure_reason_notes'],
            'auto_accepted' => false,
        ]);
    }

    $responseAtIso = null;
    if (!empty($row['buyer_response_at'])) {
        $dt = date_create($row['buyer_response_at'], new DateTimeZone('UTC'));
        if ($dt) {
            $responseAtIso = $dt->format(DateTime::ATOM);
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'confirm_request_id' => $confirmRequestId,
            'status' => $nextStatus,
            'buyer_response_at' => $responseAtIso,
            'metadata' => $metadata,
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase respond error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
