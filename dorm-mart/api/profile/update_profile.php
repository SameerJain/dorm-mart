<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/profile_helpers.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $data = get_request_data();

    if (!is_array($data)) {
        send_json_error(400, 'Invalid JSON payload');
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
        send_json_error(400, 'No updatable fields were provided');
    }

    $conn->set_charset('utf8mb4');

    $sql = 'UPDATE user_accounts SET ' . implode(', ', $setClauses) . ' WHERE user_id = ? LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }

    $types .= 'i';
    $params[] = $userId;

    $bindValues = [$types];
    foreach ($params as $key => $value) {
        $params[$key] = $value;
        $bindValues[] = &$params[$key];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindValues);

    if (!$stmt->execute()) {
        $stmt->close();
        send_json_error(500, 'Database error');
    }
    $stmt->close();

    $updatedProfile = fetch_updated_fields($conn, $userId);

    send_json_success([
        'profile' => $updatedProfile,
    ]);
} catch (InvalidArgumentException $e) {
    send_json_error(400, $e->getMessage());
} catch (Throwable $e) {
    error_log('update_profile.php error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
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
        throw new InvalidArgumentException('Invalid characters in bio');
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
        throw new InvalidArgumentException('Link is too long');
    }
    if (containsXSSPattern($link)) {
        throw new InvalidArgumentException('Invalid characters in link');
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
        throw new InvalidArgumentException('Profile photo URL is too long');
    }
    if (containsXSSPattern($url)) {
        throw new InvalidArgumentException('Invalid characters in profile photo URL');
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
        throw new InvalidArgumentException('Profile photo must reference an allowed path');
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
    if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to execute profile fetch');
    }
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return [];
    }

    return [
        'image_url' => format_profile_photo_url($row['profile_photo'] ?? null),
        'bio'       => $row['bio'] ?? '', // Note: No HTML encoding needed for JSON - React handles XSS protection
        'instagram' => $row['instagram'] ?? '',
    ];
}
