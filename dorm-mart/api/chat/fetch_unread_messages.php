<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $conn->set_charset('utf8mb4');
    $conn->query("SET time_zone = '+00:00'");

    $sql = 'SELECT conv_id, unread_count, first_unread_msg_id
            FROM conversation_participants
            WHERE user_id = ? AND unread_count > 0
            ORDER BY conv_id DESC';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }

    $stmt->bind_param('i', $userId);
    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $res = $stmt->get_result();
    if (!$res) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }

    $out = [];
    while ($row = $res->fetch_assoc()) {
        $out[] = [
            'conv_id' => (int)$row['conv_id'],
            'unread_count' => (int)$row['unread_count'],
            'first_unread_msg_id' => (int)$row['first_unread_msg_id'],
        ];
    }
    $stmt->close();

    send_json_success(['unread_counts' => $out]);
} catch (Throwable $e) {
    error_log('fetch_unread_messages error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}