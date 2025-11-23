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
    $sellerId = require_login();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $scheduledRequestId = isset($payload['scheduled_request_id']) ? (int)$payload['scheduled_request_id'] : 0;
    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;

    $isSuccessfulRaw = $payload['is_successful'] ?? null;
    if ($isSuccessfulRaw === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'is_successful is required']);
        exit;
    }
    $isSuccessful = filter_var($isSuccessfulRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($isSuccessful === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid is_successful value']);
        exit;
    }

    $finalPrice = isset($payload['final_price']) && $payload['final_price'] !== ''
        ? (float)$payload['final_price']
        : null;
    if ($finalPrice !== null && ($finalPrice < 0 || $finalPrice > 9999.99)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Final price must be between 0 and 9,999.99']);
        exit;
    }

    $sellerNotes = isset($payload['seller_notes']) ? trim((string)$payload['seller_notes']) : '';
    if (strlen($sellerNotes) > 2000) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Notes cannot exceed 2000 characters']);
        exit;
    }
    // XSS PROTECTION: Check for XSS patterns in sellerNotes
    if ($sellerNotes !== '' && containsXSSPattern($sellerNotes)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in seller notes']);
        exit;
    }

    $failureReason = isset($payload['failure_reason']) ? trim((string)$payload['failure_reason']) : null;
    $failureReasonNotes = isset($payload['failure_reason_notes']) ? trim((string)$payload['failure_reason_notes']) : null;
    $validFailureReasons = ['buyer_no_show', 'insufficient_funds', 'other'];

    if ($isSuccessful) {
        $failureReason = null;
        $failureReasonNotes = null;
    } else {
        if ($failureReason === null || $failureReason === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Failure reason is required for unsuccessful confirmations']);
            exit;
        }
        if (!in_array($failureReason, $validFailureReasons, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid failure reason']);
            exit;
        }
        if ($failureReason === 'other' && ($failureReasonNotes === null || $failureReasonNotes === '')) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Please provide details for the selected reason']);
            exit;
        }
        if ($failureReasonNotes !== null && strlen($failureReasonNotes) > 1000) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Failure notes cannot exceed 1000 characters']);
            exit;
        }
        // XSS PROTECTION: Check for XSS patterns in failureReasonNotes
        if ($failureReasonNotes !== null && $failureReasonNotes !== '' && containsXSSPattern($failureReasonNotes)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid characters in failure reason notes']);
            exit;
        }
    }

    if ($scheduledRequestId <= 0 || $conversationId <= 0 || $productId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing reference ids']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $schedStmt = $conn->prepare('
        SELECT
            spr.request_id,
            spr.inventory_product_id,
            spr.seller_user_id,
            spr.buyer_user_id,
            spr.conversation_id,
            spr.meet_location,
            spr.meeting_at,
            spr.description,
            spr.negotiated_price,
            spr.trade_item_description,
            spr.is_trade,
            spr.status,
            inv.title AS item_title,
            inv.listing_price,
            buyer.first_name AS buyer_first,
            buyer.last_name AS buyer_last,
            seller.first_name AS seller_first,
            seller.last_name AS seller_last
        FROM scheduled_purchase_requests spr
        INNER JOIN INVENTORY inv ON inv.product_id = spr.inventory_product_id
        INNER JOIN user_accounts buyer ON buyer.user_id = spr.buyer_user_id
        INNER JOIN user_accounts seller ON seller.user_id = spr.seller_user_id
        WHERE spr.request_id = ?
          AND spr.inventory_product_id = ?
          AND spr.conversation_id = ?
          AND spr.status = \'accepted\'
        LIMIT 1
    ');
    if (!$schedStmt) {
        throw new RuntimeException('Failed to prepare scheduled lookup');
    }
    $schedStmt->bind_param('iii', $scheduledRequestId, $productId, $conversationId);
    $schedStmt->execute();
    $schedRes = $schedStmt->get_result();
    $schedRow = $schedRes ? $schedRes->fetch_assoc() : null;
    $schedStmt->close();

    if (!$schedRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Scheduled purchase not found or not accepted']);
        exit;
    }

    if ((int)$schedRow['seller_user_id'] !== $sellerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You cannot confirm purchases for this listing']);
        exit;
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $pendingStmt = $conn->prepare('SELECT * FROM confirm_purchase_requests WHERE scheduled_request_id = ? AND status = \'pending\' ORDER BY confirm_request_id DESC LIMIT 1');
    $pendingStmt->bind_param('i', $scheduledRequestId);
    $pendingStmt->execute();
    $pendingRes = $pendingStmt->get_result();
    $pendingRow = $pendingRes ? $pendingRes->fetch_assoc() : null;
    $pendingStmt->close();

    if ($pendingRow) {
        $pendingRow = auto_finalize_confirm_request($conn, $pendingRow);
        if ($pendingRow && ($pendingRow['status'] ?? '') === 'pending') {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'There is already a pending confirmation for this scheduled purchase']);
            exit;
        }
    }

    $buyerId = (int)$schedRow['buyer_user_id'];
    $itemTitle = (string)$schedRow['item_title'];
    $meetingIso = null;
    if (!empty($schedRow['meeting_at'])) {
        $mt = date_create($schedRow['meeting_at'], new DateTimeZone('UTC'));
        if ($mt) {
            $meetingIso = $mt->format(DateTime::ATOM);
        }
    }

    $expiresAt = new DateTime('now', new DateTimeZone('UTC'));
    $expiresAt->modify('+24 hours');
    $expiresAtDb = $expiresAt->format('Y-m-d H:i:s');

    $payloadSnapshot = [
        'item_title' => $itemTitle,
        'buyer_id' => $buyerId,
        'seller_id' => $sellerId,
        'meet_location' => $schedRow['meet_location'],
        'meeting_at' => $meetingIso,
        'description' => $schedRow['description'],
        'negotiated_price' => $schedRow['negotiated_price'] !== null ? (float)$schedRow['negotiated_price'] : null,
        'trade_item_description' => $schedRow['trade_item_description'],
        'is_trade' => (bool)$schedRow['is_trade'],
    ];
    $payloadSnapshotJson = json_encode($payloadSnapshot, JSON_UNESCAPED_SLASHES);
    if ($payloadSnapshotJson === false) {
        throw new RuntimeException('Failed to encode snapshot');
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $insertStmt = $conn->prepare('
        INSERT INTO confirm_purchase_requests
            (scheduled_request_id, inventory_product_id, seller_user_id, buyer_user_id, conversation_id, is_successful,
             final_price, seller_notes, failure_reason, failure_reason_notes, status, expires_at, payload_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\', ?, ?)
    ');
    if (!$insertStmt) {
        throw new RuntimeException('Failed to prepare confirm insert');
    }
    $isSuccessfulInt = $isSuccessful ? 1 : 0;
    $insertStmt->bind_param(
        'iiiiiidsssss',
        $scheduledRequestId,
        $productId,
        $sellerId,
        $buyerId,
        $conversationId,
        $isSuccessfulInt,
        $finalPrice,
        $sellerNotes,
        $failureReason,
        $failureReasonNotes,
        $expiresAtDb,
        $payloadSnapshotJson
    );
    $insertStmt->execute();
    $confirmRequestId = (int)$insertStmt->insert_id;
    $insertStmt->close();

    $sellerDisplayName = trim(($schedRow['seller_first'] ?? '') . ' ' . ($schedRow['seller_last'] ?? ''));
    if ($sellerDisplayName === '') {
        $sellerDisplayName = 'User ' . $sellerId;
    }
    $buyerDisplayName = trim(($schedRow['buyer_first'] ?? '') . ' ' . ($schedRow['buyer_last'] ?? ''));
    if ($buyerDisplayName === '') {
        $buyerDisplayName = 'User ' . $buyerId;
    }

    $expiresAtIso = $expiresAt->format(DateTime::ATOM);
    $metadata = [
        'type' => 'confirm_request',
        'confirm_request_id' => $confirmRequestId,
        'scheduled_request_id' => $scheduledRequestId,
        'inventory_product_id' => $productId,
        'product_title' => $itemTitle,
        'buyer_user_id' => $buyerId,
        'seller_user_id' => $sellerId,
        'is_successful' => $isSuccessful,
        'final_price' => $finalPrice,
        'seller_notes' => $sellerNotes,
        'failure_reason' => $failureReason,
        'failure_reason_notes' => $failureReasonNotes,
        'meet_location' => $schedRow['meet_location'],
        'meeting_at' => $meetingIso,
        'expires_at' => $expiresAtIso,
        'snapshot' => $payloadSnapshot,
    ];

    $messageContent = $sellerDisplayName . ' submitted a Confirm Purchase form for ' . $itemTitle . '.';
    insert_confirm_chat_message($conn, $conversationId, $sellerId, $buyerId, $messageContent, $metadata);

    echo json_encode([
        'success' => true,
        'data' => [
            'confirm_request_id' => $confirmRequestId,
            'status' => 'pending',
            'expires_at' => $expiresAtIso,
            'metadata' => $metadata,
        ],
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase create error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
