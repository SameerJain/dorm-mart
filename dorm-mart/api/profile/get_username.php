<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/profile_helpers.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    require_login();

    $requestedId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    if ($requestedId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid user_id']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $stmt = $conn->prepare('SELECT email FROM user_accounts WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare username lookup');
    }
    $stmt->bind_param('i', $requestedId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    $conn->close();

    if (!$row || empty($row['email'])) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found']);
        exit;
    }

    $username = derive_username((string)$row['email']);

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    echo json_encode([
        'success' => true,
        'user_id' => $requestedId,
        'username' => escapeHtml($username),
    ]);
} catch (Throwable $e) {
    error_log('get_username.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
