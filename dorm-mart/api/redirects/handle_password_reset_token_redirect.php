<?php
// Handle password reset token redirects
// Redirect to the password reset page with the token

require_once __DIR__ . '/../utility/env_config.php';

$token = $_GET['token'] ?? '';
$frontendBaseUrl = get_frontend_base_url();

// Validate token exists
if (empty($token)) {
    // No token provided, redirect to login with error
    header('Location: ' . $frontendBaseUrl . '/#/login?error=invalid_reset_link');
    exit;
}

// Redirect to password reset page with token
header('Location: ' . $frontendBaseUrl . '/#/reset-password?token=' . urlencode($token));
exit;
