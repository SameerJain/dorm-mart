<?php

declare(strict_types=1);

require_once __DIR__ . '/../../database/db_connect.php';

/**
 * Fetches display names for the given user ids.
 *
 * @return array<int, string>
 */
function get_user_display_names(mysqli $conn, array $userIds): array
{
    if (empty($userIds)) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($userIds), '?'));
    $types = str_repeat('i', count($userIds));

    $stmt = $conn->prepare(
        sprintf('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (%s)', $placeholders)
    );
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare user lookup');
    }
    $bindParams = [];
    $bindParams[] = $types;
    foreach ($userIds as $idx => $value) {
        $userIds[$idx] = (int)$value;
        $bindParams[] = &$userIds[$idx];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindParams);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to execute name lookup');
    }
    $res = $stmt->get_result();
    $names = [];
    while ($row = $res->fetch_assoc()) {
        $id = (int)$row['user_id'];
        $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
        $names[$id] = $full !== '' ? $full : ('User ' . $id);
    }
    $stmt->close();
    return $names;
}

