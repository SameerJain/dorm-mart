<?php
header('Content-Type: application/json');

// Include security utilities
require_once __DIR__ . '/security/security.php';
setSecurityHeaders();
setSecureCORS();

require_once __DIR__ . '/auth/auth_handle.php';
require_once __DIR__ . '/database/db_connect.php';

// Include PHPMailer for promo email functionality
$PROJECT_ROOT = dirname(__DIR__, 1);
if (file_exists($PROJECT_ROOT . '/vendor/autoload.php')) {
    require $PROJECT_ROOT . '/vendor/autoload.php';
} else {
    require $PROJECT_ROOT . '/vendor/phpmailer/phpmailer/src/PHPMailer.php';
    require $PROJECT_ROOT . '/vendor/phpmailer/phpmailer/src/SMTP.php';
    require $PROJECT_ROOT . '/vendor/phpmailer/phpmailer/src/Exception.php';
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Ensure user is authenticated
$userId = require_login();
$conn = db();

// Helpers
function getPrefs(mysqli $conn, int $userId)
{
  // ============================================================================
  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  // ============================================================================
  // Using prepared statement with '?' placeholder and bind_param() to safely
  // handle $userId. Even if malicious SQL is in $userId, it cannot execute
  // because it's bound as an integer parameter, not concatenated into SQL.
  // ============================================================================
  $stmt = $conn->prepare('SELECT theme, promotional, reveal_contact_info, interested_category_1, interested_category_2, interested_category_3 FROM user_accounts WHERE user_id = ?');
  $stmt->bind_param('i', $userId);  // 'i' = integer type, safely bound as parameter
  $stmt->execute();
  $res = $stmt->get_result();
  $userRow = $res->fetch_assoc();
  $stmt->close();
  
  
  $theme = 'light'; // default
  if ($userRow && array_key_exists('theme', $userRow) && $userRow['theme'] !== null) {
    $theme = $userRow['theme'] ? 'dark' : 'light';
  }
  
  $promoEmails = false; // default
  if ($userRow && isset($userRow['promotional'])) {
    $promoEmails = (bool)$userRow['promotional'];
  }
  
  $revealContact = false; // default
  if ($userRow && isset($userRow['reveal_contact_info'])) {
    $revealContact = (bool)$userRow['reveal_contact_info'];
  }
  
  // Build interests array from the 3 category columns
  // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
  $interests = [];
  if ($userRow) {
    $rawInterests = array_filter([
      $userRow['interested_category_1'] ?? null,
      $userRow['interested_category_2'] ?? null,
      $userRow['interested_category_3'] ?? null
    ]);
    foreach ($rawInterests as $interest) {
      if ($interest !== null && $interest !== '') {
        $interests[] = (string)$interest;
      }
    }
  }
  
  $result = [
    'promoEmails' => $promoEmails,
    'revealContact' => $revealContact,
    'interests' => $interests,
    'theme' => $theme,
  ];
  
  return $result;
}

function sendPromoWelcomeEmail(array $user): array
{
    $PROJECT_ROOT = dirname(__DIR__, 1);

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

        $first   = escapeHtml($user['firstName'] ?: 'Student');
        $subject = 'Welcome to Dorm Mart Promotional Updates';

        // HTML email content - Subtle improvements to dark theme
        // XSS PROTECTION: User data is escaped before insertion into HTML email template
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

        // Plain-text version (no HTML escaping needed for plain text)
        $firstPlain = $user['firstName'] ?: 'Student';
        $text = <<<TEXT
Promotional Updates - Dorm Mart

Dear {$firstPlain},

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

try {
  if ($method === 'GET') {
    $data = getPrefs($conn, $userId);
    echo json_encode(['ok' => true, 'data' => $data]);
    $conn->close();
    exit;
  }

  if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) $body = [];

    /* Conditional CSRF validation - only validate if token is provided */
    $token = $body['csrf_token'] ?? null;
    if ($token !== null && !validate_csrf_token($token)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'CSRF token validation failed']);
        exit;
    }

    $promo = isset($body['promoEmails']) ? (int)!!$body['promoEmails'] : 0;
    $reveal = isset($body['revealContact']) ? (int)!!$body['revealContact'] : 0;
    $interests = isset($body['interests']) && is_array($body['interests']) ? array_slice($body['interests'], 0, 3) : [];
    $theme = (isset($body['theme']) && $body['theme'] === 'dark') ? 1 : 0;
    
    // Prepare the 3 category values
    $int1 = $interests[0] ?? null;
    $int2 = $interests[1] ?? null;
    $int3 = $interests[2] ?? null;

    // Check if user is opting into promo emails for the first time
    $shouldSendEmail = false;
    if ($promo) {
      // Check if user has never received the intro promo email
      $stmt = $conn->prepare('SELECT received_intro_promo_email FROM user_accounts WHERE user_id = ?');
      $stmt->bind_param('i', $userId);
      $stmt->execute();
      $res = $stmt->get_result();
      $userRow = $res->fetch_assoc();
      $stmt->close();
      
      // Debug logging
      if ($userRow && !$userRow['received_intro_promo_email']) {
        $shouldSendEmail = true;
      }
    }

    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // All user preference data is bound as parameters using bind_param().
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // Interests come from predefined categories (dropdown), minimizing XSS risk.
    // ============================================================================
    $stmt = $conn->prepare('UPDATE user_accounts SET theme = ?, promotional = ?, reveal_contact_info = ?, interested_category_1 = ?, interested_category_2 = ?, interested_category_3 = ? WHERE user_id = ?');
    $stmt->bind_param('iiisssi', $theme, $promo, $reveal, $int1, $int2, $int3, $userId);  // 'i'=integer, 's'=string
    $result = $stmt->execute();
    if (!$result) {
      error_log("Failed to update user_accounts: " . $stmt->error);
    }
    $stmt->close();

    // Handle received_intro_promo_email separately if needed
    if ($shouldSendEmail) {
      $stmt2 = $conn->prepare('UPDATE user_accounts SET received_intro_promo_email = 1 WHERE user_id = ?');
      $stmt2->bind_param('i', $userId);
      $stmt2->execute();
      $stmt2->close();
    }

    // Send promo welcome email if this is the first time opting in
    if ($shouldSendEmail) {
      // Get user details for email
      $stmt = $conn->prepare('SELECT first_name, last_name, email FROM user_accounts WHERE user_id = ?');
      $stmt->bind_param('i', $userId);
      $stmt->execute();
      $res = $stmt->get_result();
      $userDetails = $res->fetch_assoc();
      $stmt->close();
      
      if ($userDetails) {
        $emailResult = sendPromoWelcomeEmail([
          'firstName' => $userDetails['first_name'],
          'lastName' => $userDetails['last_name'],
          'email' => $userDetails['email']
        ]);
        
        if (!$emailResult['ok']) {
          error_log("Failed to send promo welcome email: " . $emailResult['error']);
        }
      }
    }

    echo json_encode(['ok' => true]);
    $conn->close();
    exit;
  }

  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
  $conn->close();
  exit;
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Server error']);
  if (isset($conn)) $conn->close();
  exit;
}
