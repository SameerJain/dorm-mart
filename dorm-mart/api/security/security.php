<?php
/**
 * Comprehensive Security Module
 * 
 * This file maintains backward compatibility by loading all security modules.
 * Individual modules are split into separate files for better organization.
 * 
 * @author Team f25-no-brainers
 * @version 2.0
 */

// Load all security modules
require_once __DIR__ . '/headers.php';
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/sanitization.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/rate_limiting.php';

// ============================================================================
// PASSWORD SECURITY
// ============================================================================

/**
 * Hash password securely using bcrypt
 * @param string $password Plain text password
 * @return string Hashed password
 */
function hash_password($password) {
    return password_hash($password, PASSWORD_BCRYPT);
}

/**
 * Generate a secure random password
 * 
 * @param int $length Password length (default: 8, fixed to 8 for consistency)
 * @return string Generated password
 */
function generatePassword(int $length = 8): string {
    // Fixed length of 8 characters
    $length = 8;

    $uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $lowers = 'abcdefghijklmnopqrstuvwxyz';
    $digits = '0123456789';
    $special = '!@#$%^&*()-_=+[]{};:,.?/';

    // Generate exactly 1 special character
    $password = [
        $special[random_int(0, strlen($special) - 1)],
    ];

    // Ensure at least 1 uppercase, 1 lowercase, and 1 digit (remaining 7 characters)
    $password[] = $uppers[random_int(0, strlen($uppers) - 1)];
    $password[] = $lowers[random_int(0, strlen($lowers) - 1)];
    $password[] = $digits[random_int(0, strlen($digits) - 1)];

    // Fill the remaining 4 characters from uppercase, lowercase, or digits only (no special)
    $nonSpecial = $uppers . $lowers . $digits;
    for ($i = count($password); $i < $length; $i++) {
        $password[] = $nonSpecial[random_int(0, strlen($nonSpecial) - 1)];
    }

    // Secure shuffle (Fisher–Yates)
    for ($i = count($password) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$password[$i], $password[$j]] = [$password[$j], $password[$i]];
    }

    return implode('', $password);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize security for API endpoints
 * Call this function at the start of every API endpoint
 */
function initSecurity() {
    setSecurityHeaders();
    setSecureCORS();
}
