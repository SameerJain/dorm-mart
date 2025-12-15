<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../utility/email_helpers.php';
require_once __DIR__ . '/../utility/email_templates.php';
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../database/db_connect.php';

/**
 * Send welcome email to new user
 */
function sendWelcomeGmail(array $user, string $tempPassword): array {
    $firstName = $user['firstName'] ?? 'Student';
    $lastName = $user['lastName'] ?? '';
    $email = $user['email'] ?? '';
    
    $template = get_welcome_email_template($firstName, $tempPassword);
    $toName = trim($firstName . ' ' . $lastName);
    
    $result = send_email($email, $toName, $template['subject'], $template['html'], $template['text']);
    
    return [
        'ok' => $result['success'],
        'error' => $result['error']
    ];
}

// Bootstrap API with POST method (no auth required - this is account creation)
api_bootstrap('POST', false);

$data = get_request_data();

$firstNameRaw = trim($data['firstName'] ?? '');
$lastNameRaw = trim($data['lastName'] ?? '');
$emailRaw = strtolower(trim($data['email'] ?? ''));

if (containsXSSPattern($firstNameRaw) || containsXSSPattern($lastNameRaw)) {
    send_json_error(400, 'Invalid input format');
}

$firstName = validateInput($firstNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$lastName = validateInput($lastNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$gradMonth = sanitize_number($data['gradMonth'] ?? 0, 1, 12);
$gradYear  = sanitize_number($data['gradYear'] ?? 0, 1900, 2030);
$email = validateInput($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
$promos = !empty($data['promos']);

if ($firstName === false || $lastName === false || $email === false) {
    send_json_error(400, 'Invalid input format');
}

if ($firstName === '' || $lastName === '' || $email === '') {
    send_json_error(400, 'Missing required fields');
}

if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
    send_json_error(400, 'Email must be @buffalo.edu');
}

if ($gradMonth < 1 || $gradMonth > 12 || $gradYear < 1900) {
    send_json_error(400, 'Invalid graduation date');
}

$currentYear = (int)date('Y');
$currentMonth = (int)date('n');
$maxFutureYear = $currentYear + 8;

if ($gradYear < $currentYear || ($gradYear === $currentYear && $gradMonth < $currentMonth)) {
    send_json_error(400, 'Graduation date cannot be in the past');
}

if ($gradYear > $maxFutureYear || ($gradYear === $maxFutureYear && $gradMonth > $currentMonth)) {
    send_json_error(400, 'Graduation date cannot be more than 8 years in the future');
}

try {
    $conn = db();
    
    $chk = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
    if (!$chk) {
        send_json_error(500, 'Database error');
    }
    $chk->bind_param('s', $email);
    if (!$chk->execute()) {
        $chk->close();
        send_json_error(500, 'Database error');
    }
    $chk->store_result();
    if ($chk->num_rows > 0) {
        $chk->close();
        send_json_success([]);
    }
    $chk->close();

    $tempPassword = generatePassword();
    $hashPass = password_hash($tempPassword, PASSWORD_BCRYPT);

    $sql = 'INSERT INTO user_accounts
          (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, join_date, seller, theme, received_intro_promo_email)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_DATE, 0, 0, ?)';

    $ins = $conn->prepare($sql);
    if (!$ins) {
        send_json_error(500, 'Database error');
    }
    
    $promotional = $promos ? 1 : 0;
    $receivedIntroPromoEmail = $promos ? 1 : 0;
    $ins->bind_param(
        'ssiisisi',
        $firstName,
        $lastName,
        $gradMonth,
        $gradYear,
        $email,
        $promotional,
        $hashPass,
        $receivedIntroPromoEmail,
    );

    if (!$ins->execute()) {
        $ins->close();
        send_json_error(500, 'Failed to create account');
    }
    $ins->close();

    sendWelcomeGmail(["firstName" => $firstName, "lastName" => $lastName, "email" => $email], $tempPassword);

    send_json_success([]);
} catch (Throwable $e) {
    error_log('create_account error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}
