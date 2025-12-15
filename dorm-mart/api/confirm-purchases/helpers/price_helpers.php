<?php

declare(strict_types=1);

require_once __DIR__ . '/../../database/db_connect.php';

function get_confirm_snapshot(array $row): array
{
    if (empty($row['payload_snapshot'])) {
        return [];
    }
    $decoded = json_decode($row['payload_snapshot'], true);
    return is_array($decoded) ? $decoded : [];
}

function resolve_confirm_final_price(mysqli $conn, array $row, array $snapshot): ?float
{
    if (isset($row['final_price']) && $row['final_price'] !== null) {
        return (float)$row['final_price'];
    }
    if (isset($snapshot['negotiated_price']) && $snapshot['negotiated_price'] !== null) {
        return (float)$snapshot['negotiated_price'];
    }

    $productId = isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : 0;
    if ($productId <= 0) {
        return null;
    }

    $priceStmt = $conn->prepare('SELECT listing_price FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$priceStmt) {
        return null;
    }
    $priceStmt->bind_param('i', $productId);
    if (!$priceStmt->execute()) {
        $priceStmt->close();
        return null;
    }
    $res = $priceStmt->get_result();
    $priceRow = $res ? $res->fetch_assoc() : null;
    $priceStmt->close();

    if ($priceRow && $priceRow['listing_price'] !== null) {
        return (float)$priceRow['listing_price'];
    }

    return null;
}

/**
 * Builds a metadata payload for confirm responses so that React can display a card.
 */
function build_confirm_response_metadata(array $row, string $type): array
{
    $snapshot = [];
    if (!empty($row['payload_snapshot'])) {
        $decoded = json_decode($row['payload_snapshot'], true);
        if (is_array($decoded)) {
            $snapshot = $decoded;
        }
    }

    $confirmPurchaseStatus = null;
    if ($type === 'confirm_accepted') {
        $confirmPurchaseStatus = 'buyer_accepted';
    } elseif ($type === 'confirm_auto_accepted') {
        $confirmPurchaseStatus = 'auto_accepted';
    } elseif ($type === 'confirm_denied') {
        $confirmPurchaseStatus = 'buyer_declined';
    } elseif (isset($row['status'])) {
        $status = (string)$row['status'];
        if ($status === 'buyer_accepted') {
            $confirmPurchaseStatus = 'buyer_accepted';
        } elseif ($status === 'auto_accepted') {
            $confirmPurchaseStatus = 'auto_accepted';
        } elseif ($status === 'buyer_declined') {
            $confirmPurchaseStatus = 'buyer_declined';
        }
    }

    return [
        'type' => $type,
        'confirm_request_id' => (int)$row['confirm_request_id'],
        'scheduled_request_id' => isset($row['scheduled_request_id']) ? (int)$row['scheduled_request_id'] : null,
        'inventory_product_id' => isset($row['inventory_product_id']) ? (int)$row['inventory_product_id'] : null,
        'is_successful' => isset($row['is_successful']) ? (bool)$row['is_successful'] : null,
        'final_price' => isset($row['final_price']) ? (float)$row['final_price'] : null,
        'seller_notes' => $row['seller_notes'] ?? null,
        'failure_reason' => $row['failure_reason'] ?? null,
        'failure_reason_notes' => $row['failure_reason_notes'] ?? null,
        'snapshot' => $snapshot,
        'responded_at' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM),
        'confirm_purchase_status' => $confirmPurchaseStatus,
    ];
}



