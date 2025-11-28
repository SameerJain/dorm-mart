<?php
declare(strict_types=1);

// api/me.php

// Include security headers and CORS
require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// CORS / preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    require __DIR__ . '/auth/auth_handle.php';
    require __DIR__ . '/database/db_connect.php'; // adjust path

    auth_boot_session();
    $userId = require_login();

    $mysqli = db();

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
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();

    if (!$row) {
        echo json_encode([
            'ok' => true,
            'id' => $userId,
            'name' => null,
            'email' => null,
            'interested_categories' => [],
        ]);
        exit;
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $cats = [];
    $c1 = trim((string)($row['interested_category_1'] ?? ''));
    $c2 = trim((string)($row['interested_category_2'] ?? ''));
    $c3 = trim((string)($row['interested_category_3'] ?? ''));

    if ($c1 !== '') $cats[] = escapeHtml($c1);
    if ($c2 !== '' && $c2 !== $c1) $cats[] = escapeHtml($c2);
    if ($c3 !== '' && $c3 !== $c1 && $c3 !== $c2) $cats[] = escapeHtml($c3);

    $cats = array_slice($cats, 0, 3);

    echo json_encode([
        'ok' => true,
        'interested_categories' => $cats,
    ]);
    exit;

} catch (Throwable $e) {
    error_log('me.php error: ' . $e->getMessage());
    http_response_code(500);
    // XSS PROTECTION: Escape error message to prevent XSS if it contains user input
    // SECURITY: In production, consider removing 'detail' field to prevent information disclosure
    echo json_encode([
        'ok' => false,
        'error' => 'Server error',
        'detail' => escapeHtml($e->getMessage()),
    ]);
    exit;
}
