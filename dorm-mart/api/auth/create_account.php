<?php

// Include security utilities
require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/auth_handle.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

/*composer needs to be installed in order to enable mailing services
Get composer from getcomposer.org
Run in cmd at dorm-mart
composer require phpmailer/phpmailer

If composer cannot be installed or is giving errors then follow the following steps:
1. Download PHPMailer ZIP: https://github.com/PHPMailer/PHPMailer/releases
2. Extract src/ into dorm-mart/vendor/PHPMailer/src
*/


$PROJECT_ROOT = dirname(__DIR__, 2);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} else {
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/PHPMailer.php';
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/SMTP.php';
    require $PROJECT_ROOT . '/vendor/PHPMailer/src/Exception.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;




function generatePassword(int $length = 8): string
{
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

    // secure shuffle (Fisher–Yates)
    for ($i = count($password) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$password[$i], $password[$j]] = [$password[$j], $password[$i]];
    }

    return implode('', $password);
}

// Example:
// echo generatePassword(12);

function sendWelcomeGmail(array $user, string $tempPassword): array
{
    global $PROJECT_ROOT;

    // pick an env file (cleaned)
    foreach (["$PROJECT_ROOT/.env.development", "$PROJECT_ROOT/.env.local", "$PROJECT_ROOT/.env.production", "$PROJECT_ROOT/.env.cattle"] as $envFile) {
        if (is_readable($envFile)) {
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) continue;
                [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
                putenv(trim($k) . '=' . trim($v));
            }
            break;
        }
    }

    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        // SMTP Configuration with optimizations for production servers
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('GMAIL_USERNAME');
        $mail->Password   = getenv('GMAIL_PASSWORD');
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // or STARTTLS 587
        $mail->Port       = 465;

        // Optimizations for faster email delivery
        $mail->Timeout = 30; // Reduced timeout for faster failure detection
        $mail->SMTPKeepAlive = false; // Close connection after sending
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Tell PHPMailer we are sending UTF-8 and how to encode it
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64'; // robust for UTF-8; 'quoted-printable' also fine
        // Optional: $mail->setLanguage('en');

        // From/To
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));

        // XSS PROTECTION: Escape user data before inserting into HTML email template
        $first   = escapeHtml($user['firstName'] ?: 'Student');
        $tempPasswordEscaped = escapeHtml($tempPassword);
        $subject = 'Welcome to Dorm Mart';

        // Use HTML entities for punctuation (— →) to avoid mojibake in some clients
        $html = <<<HTML
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>{$subject}</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;margin:0;padding:16px;background:#111;">
    <div style="max-width:640px;margin:0 auto;background:#1e1e1e;border-radius:8px;padding:20px;">
      <p style="color:#eee;">Dear {$first},</p>
      <p style="color:#eee;">Welcome to <strong>Dorm Mart</strong> &mdash; the student marketplace for UB.</p>
      <p style="color:#eee;">Here is your temporary (current) password. <strong>DO NOT</strong> share this with anyone.</p>
      <p style="font-size:20px;color:#fff;"><strong>{$tempPasswordEscaped}</strong></p>
      <p style="color:#eee;">If you want to change this password, go to <em>Settings &rarr; Change Password</em>.</p>
      <p style="color:#eee;">Happy trading,<br/>The Dorm Mart Team</p>
      <hr style="border:none;border-top:1px solid #333;margin:16px 0;">
      <p style="font-size:12px;color:#aaa;">This is an automated message; do not reply. For support:
      <a href="mailto:dormmartsupport@gmail.com" style="color:#9db7ff;">dormmartsupport@gmail.com</a></p>
    </div>
  </body>
</html>
HTML;

        // Plain-text part: stick to ASCII symbols (no HTML escaping needed for plain text)
        $firstPlain = $user['firstName'] ?: 'Student';
        $text = <<<TEXT
Dear {$firstPlain},

Welcome to Dorm Mart - the student marketplace for UB.

Here is your temporary (current) password. DO NOT share this with anyone.

{$tempPassword}

If you want to change this password, go to Settings -> Change Password.

Happy trading,
The Dorm Mart Team

(This is an automated message; do not reply. Support: dormmartsupport@gmail.com)
TEXT;

        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body    = $html;
        $mail->AltBody = $text;

        $mail->send();
        return ['ok' => true, 'error' => null];
    } catch (Exception $e) {
        return ['ok' => false, 'error' => $mail->ErrorInfo];
    }
}

function sendPromoWelcomeEmail(array $user): array
{
    global $PROJECT_ROOT;

    // Load environment variables
    foreach (["$PROJECT_ROOT/.env.development", "$PROJECT_ROOT/.env.local", "$PROJECT_ROOT/.env.production", "$PROJECT_ROOT/.env.cattle"] as $envFile) {
        if (is_readable($envFile)) {
            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) continue;
                [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
                putenv(trim($k) . '=' . trim($v));
            }
            break;
        }
    }

    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    try {
        // SMTP Configuration
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('GMAIL_USERNAME');
        $mail->Password   = getenv('GMAIL_PASSWORD');
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;

        // Optimizations for faster email delivery
        $mail->Timeout = 30;
        $mail->SMTPKeepAlive = false;
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Tell PHPMailer we are sending UTF-8
        $mail->CharSet   = 'UTF-8';
        $mail->Encoding  = 'base64';

        // From/To
        $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
        $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));

        $first   = $user['firstName'] ?: 'Student';
        $subject = 'Welcome to Dorm Mart Promotional Updates';

        // HTML email content - Subtle improvements to dark theme
        $html = <<<HTML
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>{$subject}</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;margin:0;padding:16px;background:#111;">
    <div style="max-width:640px;margin:0 auto;background:#1e1e1e;border-radius:12px;padding:24px;border:1px solid #333;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#2563EB;margin:0;font-size:24px;font-weight:bold;">📧 Promotional Updates</h1>
        <div style="width:60px;height:3px;background:linear-gradient(90deg, #2563EB, #1d4ed8);margin:8px auto;border-radius:2px;"></div>
      </div>
      
      <p style="color:#eee;font-size:16px;margin:0 0 16px 0;">Dear {$first},</p>
      
      <p style="color:#eee;margin:0 0 20px 0;">Thank you for opting into promotional updates from <strong style="color:#2563EB;">Dorm Mart</strong>!</p>
      
      <div style="background:#2a2a2a;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #2563EB;">
        <p style="color:#eee;margin:0 0 12px 0;font-weight:bold;">You'll now receive updates about:</p>
        <ul style="color:#ddd;margin:0;padding-left:20px;">
          <li style="margin:6px 0;">Emails about your notifcations tab</li>
          <li style="margin:6px 0;">New website news and updates</li>
        </ul>
      </div>
      
      <p style="color:#eee;margin:20px 0;">This is a one-time email for the first time you ever sign up for promotional updates with an account. We promise to keep our emails relevant and not overwhelm your inbox. You can always update your preferences in your account settings.</p>
      
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;background:#333;padding:12px 24px;border-radius:6px;border:1px solid #2563EB;">
          <span style="color:#2563EB;font-weight:bold;">✓ Successfully Subscribed</span>
        </div>
      </div>
      
      <p style="color:#eee;margin:20px 0 0 0;">
        Happy trading,<br/>
        <strong style="color:#2563EB;">The Dorm Mart Team</strong>
      </p>
      
      <hr style="border:none;border-top:1px solid #333;margin:20px 0;">
      <p style="font-size:12px;color:#aaa;margin:0;">This is an automated message; do not reply. For support:
      <a href="mailto:dormmartsupport@gmail.com" style="color:#2563EB;">dormmartsupport@gmail.com</a></p>
    </div>
  </body>
</html>
HTML;

        // Plain-text version
        $text = <<<TEXT
Promotional Updates - Dorm Mart

Dear {$first},

Thank you for opting into promotional updates from Dorm Mart!

You'll now receive updates about:
- Important updates and announcements
- New features and improvements  
- Campus marketplace tips

We promise to keep our emails relevant and not overwhelm your inbox. You can always update your preferences in your account settings.

✓ Successfully Subscribed

Happy trading,
The Dorm Mart Team

(This is an automated message; do not reply. Support: dormmartsupport@gmail.com)
TEXT;

        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body    = $html;
        $mail->AltBody = $text;

        $mail->send();
        return ['ok' => true, 'error' => null];
    } catch (Exception $e) {
        return ['ok' => false, 'error' => $mail->ErrorInfo];
    }
}



// Include security headers for XSS protection
require_once __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Enforce POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Read the JSON body from React's fetch()
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

// Handle bad JSON
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
    exit;
}

// Extract the values (before validation)
$firstNameRaw = trim($data['firstName'] ?? '');
$lastNameRaw = trim($data['lastName'] ?? '');
$emailRaw = strtolower(trim($data['email'] ?? ''));

// XSS PROTECTION: Check for XSS patterns in firstName and lastName fields
// Note: SQL injection is already prevented by prepared statements and regex validation
if (containsXSSPattern($firstNameRaw) || containsXSSPattern($lastNameRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input format']);
    exit;
}

// XSS PROTECTION: Input validation with regex patterns to prevent XSS attacks
$firstName = validateInput($firstNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$lastName = validateInput($lastNameRaw, 100, '/^[a-zA-Z\s\-\']+$/');
$gradMonth = sanitize_number($data['gradMonth'] ?? 0, 1, 12);
$gradYear  = sanitize_number($data['gradYear'] ?? 0, 1900, 2030);
$email = validateInput($emailRaw, 255, '/^[^@\s]+@buffalo\.edu$/');
$promos    = !empty($data['promos']);

if ($firstName === false || $lastName === false || $email === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid input format']);
    exit;
}

// Validate
if ($firstName === '' || $lastName === '' || $email === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
    exit;
}

if (!preg_match('/^[^@\s]+@buffalo\.edu$/', $email)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email must be @buffalo.edu']);
    exit;
}
// --- Validate graduation date format ---
if ($gradMonth < 1 || $gradMonth > 12 || $gradYear < 1900) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid graduation date']);
    exit;
}

// --- Current and limit dates ---
$currentYear  = (int)date('Y');
$currentMonth = (int)date('n');
$maxFutureYear = $currentYear + 8;

// --- Check for past date ---
if ($gradYear < $currentYear || ($gradYear === $currentYear && $gradMonth < $currentMonth)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Graduation date cannot be in the past']);
    exit;
}

// --- Check for excessive future date ---
if ($gradYear > $maxFutureYear || ($gradYear === $maxFutureYear && $gradMonth > $currentMonth)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Graduation date cannot be more than 8 years in the future']);
    exit;
}

require "../database/db_connect.php";
$conn = db();
try {
    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // Check if email already exists using prepared statement.
    // The '?' placeholder and bind_param() ensure $email is treated as data, not SQL.
    // This prevents SQL injection even if malicious SQL code is in the email field.
    // ============================================================================
    $chk = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
    $chk->bind_param('s', $email);  // 's' = string type, safely bound as parameter
    $chk->execute();
    $chk->store_result();                   // needed to use num_rows without fetching
    if ($chk->num_rows > 0) {
        http_response_code(200);
        echo json_encode(['ok' => true]);
        exit;
    }
    $chk->close();

    // 2) Generate & hash password
    // SECURITY NOTE:
    // We NEVER store plaintext passwords. We generate a temporary password for the
    // new user and immediately hash it with password_hash(), which automatically
    // generates a unique SALT and embeds it into the returned hash (bcrypt here).
    // The database only stores this salted, one-way hash (column: hash_pass).
    $tempPassword = generatePassword(8);
    $hashPass     = password_hash($tempPassword, PASSWORD_BCRYPT);

    // 3) Insert user
    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // All user input (firstName, lastName, email, etc.) is inserted using prepared statement
    // with parameter binding. The '?' placeholders ensure user input is treated as data,
    // not executable SQL. This prevents SQL injection attacks even if malicious SQL code
    // is present in any of the input fields.
    // ============================================================================
    $sql = 'INSERT INTO user_accounts
          (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, join_date, seller, theme, received_intro_promo_email)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_DATE, 0, 0, ?)';

    $ins = $conn->prepare($sql);
    /*
    types: s=string, i=int
    first_name(s), last_name(s), grad_month(i), grad_year(i),
    email(s), promotional(i), hash_pass(s), hash_auth(s), received_intro_promo_email(i)
*/
    $promotional = $promos ? 1 : 0;
    $receivedIntroPromoEmail = $promos ? 1 : 0; // Set to TRUE if promotional emails are enabled
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

    $ok = $ins->execute();
    $ins->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Insert failed']);
        exit;
    }

    // Send welcome email (ignore result here)
    sendWelcomeGmail(["firstName" => $firstName, "lastName" => $lastName, "email" => $email], $tempPassword);

    // Promo email is no longer sent during account creation
    // Promo emails will only be sent from user preferences settings
    // The promotional preference is still saved to the database above
    /*
    // Send promo welcome email if user opted into promotional emails
    if ($promos) {
        $promoEmailResult = sendPromoWelcomeEmail(["firstName" => $firstName, "lastName" => $lastName, "email" => $email]);
        if (!$promoEmailResult['ok']) {
            error_log("Failed to send promo welcome email during account creation: " . $promoEmailResult['error']);
        }
    }
    */

    // Success
    echo json_encode([
        'ok' => true
    ]);
} catch (Throwable $e) {
    // Log $e->getMessage() server-side
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => "There was an error"]);
}
