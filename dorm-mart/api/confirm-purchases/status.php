<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/helpers.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;

    if ($conversationId <= 0 || $productId <= 0) {
        send_json_error(400, 'conversation_id and product_id are required');
    }

    $conn->set_charset('utf8mb4');

    $convStmt = $conn->prepare('
        SELECT c.conv_id, c.product_id, inv.seller_id, inv.title AS item_title
        FROM conversations c
        INNER JOIN INVENTORY inv ON inv.product_id = c.product_id
        WHERE c.conv_id = ? AND c.product_id = ?
        LIMIT 1
    ');
    if (!$convStmt) {
        send_json_error(500, 'Database error');
    }
    $convStmt->bind_param('ii', $conversationId, $productId);
    if (!$convStmt->execute()) {
        $convStmt->close();
        send_json_error(500, 'Database error');
    }
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        send_json_error(404, 'Conversation not found for this listing');
    }

    if ((int)$convRow['seller_id'] !== $userId) {
        send_json_success([
            'can_confirm' => false,
            'reason_code' => 'not_seller',
            'message' => 'Only the seller can send a Confirm Purchase form.',
        ]);
    }

    $schedStmt = $conn->prepare('
        SELECT *
        FROM scheduled_purchase_requests
        WHERE conversation_id = ?
          AND inventory_product_id = ?
          AND seller_user_id = ?
          AND status = \'accepted\'
        ORDER BY COALESCE(updated_at, buyer_response_at) DESC, request_id DESC
        LIMIT 1
    ');
    if (!$schedStmt) {
        send_json_error(500, 'Database error');
    }
    $schedStmt->bind_param('iii', $conversationId, $productId, $userId);
    if (!$schedStmt->execute()) {
        $schedStmt->close();
        send_json_error(500, 'Database error');
    }
    $schedRes = $schedStmt->get_result();
    $schedRow = $schedRes ? $schedRes->fetch_assoc() : null;
    $schedStmt->close();

    if (!$schedRow) {
        send_json_success([
            'can_confirm' => false,
            'reason_code' => 'missing_schedule',
            'message' => 'First, send the Schedule Purchase form. Then once the exchange is complete, send the Confirm Purchase form.',
        ]);
    }

    $meetingIso = null;
    if (!empty($schedRow['meeting_at'])) {
        $mt = date_create($schedRow['meeting_at'], new DateTimeZone('UTC'));
        if ($mt) {
            $meetingIso = $mt->format(DateTime::ATOM);
        }
    }

    $scheduledInfo = [
        'request_id' => (int)$schedRow['request_id'],
        'buyer_user_id' => (int)$schedRow['buyer_user_id'],
        'meet_location' => $schedRow['meet_location'] ?? '',
        'meeting_at' => $meetingIso,
    ];

    $confirmStmt = $conn->prepare('
        SELECT *
        FROM confirm_purchase_requests
        WHERE scheduled_request_id = ?
        ORDER BY confirm_request_id DESC
        LIMIT 1
    ');
    if (!$confirmStmt) {
        send_json_error(500, 'Database error');
    }
    $confirmStmt->bind_param('i', $schedRow['request_id']);
    if (!$confirmStmt->execute()) {
        $confirmStmt->close();
        send_json_error(500, 'Database error');
    }
    $confirmRes = $confirmStmt->get_result();
    $confirmRow = $confirmRes ? $confirmRes->fetch_assoc() : null;
    $confirmStmt->close();

    $latestConfirm = null;
    $pendingRequest = null;
    $canConfirm = true;
    $reasonCode = null;
    $message = null;

    if ($confirmRow) {
        $confirmRow = auto_finalize_confirm_request($conn, $confirmRow) ?? $confirmRow;
        $latestConfirm = [
            'confirm_request_id' => (int)$confirmRow['confirm_request_id'],
            'status' => $confirmRow['status'],
            'expires_at' => $confirmRow['expires_at'],
            'buyer_response_at' => $confirmRow['buyer_response_at'],
        ];

        if ($confirmRow['status'] === 'pending') {
            $pendingRequest = [
                'confirm_request_id' => (int)$confirmRow['confirm_request_id'],
                'expires_at' => $confirmRow['expires_at'],
            ];
            $canConfirm = false;
            $reasonCode = 'pending_request';
            $message = 'There is already a Confirm Purchase waiting for buyer response.';
        } elseif (in_array($confirmRow['status'], ['buyer_accepted', 'auto_accepted'], true)) {
            $canConfirm = false;
            $reasonCode = 'already_confirmed';
            $message = 'This transaction has already been confirmed.';
        } elseif ($confirmRow['status'] === 'seller_cancelled') {
            $canConfirm = true;
        } else {
            // buyer_declined or other terminal state – seller may resend
            $canConfirm = true;
        }
    }

    send_json_success([
        'can_confirm' => $canConfirm,
        'reason_code' => $reasonCode,
        'message' => $message,
        'scheduled_request' => $scheduledInfo,
        'pending_request' => $pendingRequest,
        'latest_confirm' => $latestConfirm,
    ]);
} catch (Throwable $e) {
    error_log('confirm-purchase status error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}
