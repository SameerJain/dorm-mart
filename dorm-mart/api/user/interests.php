<?php
declare(strict_types=1);

// api/me.php

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$mysqli = $result['conn'];

try {

    $stmt = $mysqli->prepare("
        SELECT 
           email,
           interested_category_1, 
           interested_category_2,
           interested_category_3
        FROM user_accounts
        WHERE user_id = ?
        LIMIT 1
    ");
    if (!$stmt) {
    throw new Exception("SQL prepare failed: " . $mysqli->error);
}
    $stmt->bind_param('i', $userId);
    if (!$stmt->execute()) {
        $stmt->close();
        throw new Exception("SQL execute failed: " . $stmt->error);
    }
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();

    if (!$row) {
        send_json_success([
            'ok' => true,
            'id' => $userId,
            'name' => null,
            'email' => null,
            'interested_categories' => [],
        ]);
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $cats = [];
    $c1 = trim((string)($row['interested_category_1'] ?? ''));
    $c2 = trim((string)($row['interested_category_2'] ?? ''));
    $c3 = trim((string)($row['interested_category_3'] ?? ''));

    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    if ($c1 !== '') $cats[] = $c1;
    if ($c2 !== '' && $c2 !== $c1) $cats[] = $c2;
    if ($c3 !== '' && $c3 !== $c1 && $c3 !== $c2) $cats[] = $c3;

    $cats = array_slice($cats, 0, 3);

    send_json_success([
        'ok' => true,
        'interested_categories' => $cats,
    ]);

} catch (Throwable $e) {
    error_log('me.php error: ' . $e->getMessage());
    // Note: No HTML encoding needed for JSON - React handles XSS protection
    // SECURITY: In production, consider removing 'detail' field to prevent information disclosure
    send_json_error(500, 'Server error', ['detail' => $e->getMessage()]);
}
