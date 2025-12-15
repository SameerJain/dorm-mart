<?php
declare(strict_types=1);

if (!function_exists('derive_username')) {
    function derive_username(string $email): string
    {
        $email = trim($email);
        if ($email === '') {
            return '';
        }
        $atPos = strpos($email, '@');
        if ($atPos === false) {
            return $email;
        }
        return substr($email, 0, $atPos);
    }
}

if (!function_exists('format_profile_photo_url')) {
    function format_profile_photo_url($value): ?string
    {
        return format_profile_media_url($value);
    }
}

if (!function_exists('format_review_image_url')) {
    function format_review_image_url($value): ?string
    {
        return format_profile_media_url($value);
    }
}

if (!function_exists('format_profile_media_url')) {
    function format_profile_media_url($value): ?string
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

        if (strpos($trimmed, '/api/media/image.php') === 0 || strpos($trimmed, '/api/image.php') === 0) {
            return $trimmed;
        }

        if ($trimmed[0] !== '/') {
            $trimmed = '/' . ltrim($trimmed, '/');
        }

        return build_profile_image_proxy_url($trimmed);
    }
}

if (!function_exists('build_profile_image_proxy_url')) {
    function build_profile_image_proxy_url(string $source): string
    {
        $apiBase = rtrim(get_profile_api_base_path(), '/');
        if ($apiBase === '') {
            $apiBase = '/api';
        }
        return $apiBase . '/media/image.php?url=' . rawurlencode($source);
    }
}

if (!function_exists('get_profile_api_base_path')) {
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
}

/**
 * Build seller name from database row
 * Uses first_name + last_name, falls back to email if names not available
 * 
 * @param array $row Database row with first_name, last_name, and/or email
 * @return string Seller name
 */
function build_seller_name(array $row): string {
    $firstName = trim((string)($row['first_name'] ?? ''));
    $lastName = trim((string)($row['last_name'] ?? ''));
    
    if ($firstName !== '' || $lastName !== '') {
        return trim($firstName . ' ' . $lastName);
    }
    
    if (!empty($row['email'])) {
        return (string)$row['email'];
    }
    
    return 'Unknown Seller';
}