<?php
declare(strict_types=1);

/**
 * POST /api/profile/update_profile.php
 * Persists editable profile fields such as bio, instagram URL, and profile photo reference.
 */

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

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
    $userId = require_login();
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $setClauses = [];
    $types      = '';
    $params     = [];

    if (array_key_exists('bio', $data)) {
        $bio = sanitize_bio_value($data['bio']);
        if ($bio === null) {
            $setClauses[] = 'bio = NULL';
        } else {
            $setClauses[] = 'bio = ?';
            $types       .= 's';
            $params[]     = $bio;
        }
    }

    if (array_key_exists('instagram', $data)) {
        $instagram = sanitize_link_value($data['instagram']);
        if ($instagram === null) {
            $setClauses[] = 'instagram = NULL';
        } else {
            $setClauses[] = 'instagram = ?';
            $types       .= 's';
            $params[]     = $instagram;
        }
    }

    $photoKey = null;
    foreach (['profile_photo', 'profile_photo_url', 'image_url'] as $candidate) {
        if (array_key_exists($candidate, $data)) {
            $photoKey = $candidate;
            break;
        }
    }
    if ($photoKey !== null) {
        $photoPath = sanitize_profile_photo_value($data[$photoKey]);
        if ($photoPath === null) {
            $setClauses[] = 'profile_photo = NULL';
        } else {
            $setClauses[] = 'profile_photo = ?';
            $types       .= 's';
            $params[]     = $photoPath;
        }
    }

    if (empty($setClauses)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No updatable fields were provided']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $sql = 'UPDATE user_accounts SET ' . implode(', ', $setClauses) . ' WHERE user_id = ? LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare profile update');
    }

    $types   .= 'i';
    $params[] = $userId;

    $bindValues = [$types];
    foreach ($params as $key => $value) {
        $params[$key] = $value;
        $bindValues[] = &$params[$key];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindValues);

    $stmt->execute();
    $stmt->close();

    $updatedProfile = fetch_updated_fields($conn, $userId);
    $conn->close();

    echo json_encode([
        'success' => true,
        'profile' => $updatedProfile,
    ]);
} catch (Throwable $e) {
    error_log('update_profile.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

function sanitize_bio_value($value): ?string
{
    if ($value === null) {
        return null;
    }
    $bio = trim((string)$value);
    if ($bio === '') {
        return null;
    }
    if (containsXSSPattern($bio)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in bio']);
        exit;
    }
    $bio = mb_substr($bio, 0, 200);
    return $bio;
}

function sanitize_link_value($value): ?string
{
    if ($value === null) {
        return null;
    }
    $link = trim((string)$value);
    if ($link === '') {
        return null;
    }
    if (strlen($link) > 255) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Link is too long']);
        exit;
    }
    if (containsXSSPattern($link)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in link']);
        exit;
    }
    return $link;
}

function sanitize_profile_photo_value($value): ?string
{
    if ($value === null) {
        return null;
    }
    $url = trim((string)$value);
    if ($url === '') {
        return null;
    }
    if (strlen($url) > 255) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Profile photo URL is too long']);
        exit;
    }
    if (containsXSSPattern($url)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in profile photo URL']);
        exit;
    }

    $allowedSchemes = ['http://', 'https://', '/media/', '/images/'];
    $isAllowed = false;
    foreach ($allowedSchemes as $prefix) {
        if (str_starts_with($url, $prefix)) {
            $isAllowed = true;
            break;
        }
    }
    if (!$isAllowed) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Profile photo must reference an allowed path']);
        exit;
    }

    return $url;
}

function fetch_updated_fields(mysqli $conn, int $userId): array
{
    $stmt = $conn->prepare('SELECT profile_photo, bio, instagram FROM user_accounts WHERE user_id = ? LIMIT 1');
    if (!$stmt) {
        throw new RuntimeException('Failed to load updated profile');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return [];
    }

    return [
        'image_url' => format_profile_photo_url($row['profile_photo'] ?? null),
        'bio'       => escapeHtml($row['bio'] ?? ''),
        'instagram' => $row['instagram'] ?? '',
    ];
}

function format_profile_photo_url($value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $trimmed = trim($value);
    if ($trimmed === '') {
        return null;
    }

    if (preg_match('#^https?://#i', $trimmed) || strpos($trimmed, 'data:') === 0) {
        return $trimmed;
    }

    if (strpos($trimmed, '/api/image.php') === 0) {
        return $trimmed;
    }

    if ($trimmed[0] !== '/') {
        $trimmed = '/' . ltrim($trimmed, '/');
    }

    return build_profile_image_proxy_url($trimmed);
}

function build_profile_image_proxy_url(string $source): string
{
    $apiBase = rtrim(get_profile_api_base_path(), '/');
    if ($apiBase === '') {
        $apiBase = '/api';
    }
    return $apiBase . '/image.php?url=' . rawurlencode($source);
}

function get_profile_api_base_path(): string
{
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
    if ($scriptName === '') {
        return '/api';
    }
    $profileDir = dirname($scriptName);
    $apiBase = dirname($profileDir);
    if ($apiBase === '.' || $apiBase === DIRECTORY_SEPARATOR) {
        return '/api';
    }
    return $apiBase;
}
