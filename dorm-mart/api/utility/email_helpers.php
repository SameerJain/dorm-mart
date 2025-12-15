<?php

declare(strict_types=1);

/**
 * Email Helper Utilities
 * 
 * Centralized PHPMailer setup and email sending functions
 */

require_once __DIR__ . '/load_env.php';
require_once __DIR__ . '/../security/security.php';

// Load PHPMailer
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

// Ensure environment is loaded
load_env();

/**
 * Setup and configure PHPMailer instance
 * 
 * @return PHPMailer Configured PHPMailer instance
 */
function setup_phpmailer(): PHPMailer {
    // Ensure PHP is using UTF-8 internally
    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new PHPMailer(true);
    
    // SMTP Configuration with optimizations for production servers
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = getenv('GMAIL_USERNAME');
    $mail->Password   = getenv('GMAIL_PASSWORD');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
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
    $mail->Encoding  = 'base64'; // robust for UTF-8

    // Set default From/Reply-To
    $mail->setFrom(getenv('GMAIL_USERNAME'), 'Dorm Mart');
    $mail->addReplyTo(getenv('GMAIL_USERNAME'), 'Dorm Mart Support');

    return $mail;
}

/**
 * Send an email using PHPMailer
 * 
 * @param string $toEmail Recipient email address
 * @param string $toName Recipient name
 * @param string $subject Email subject
 * @param string $htmlBody HTML email body
 * @param string $textBody Plain text email body
 * @return array Result array with 'success' (bool) and 'error' (string|null)
 */
function send_email(string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody): array {
    try {
        $mail = setup_phpmailer();
        $mail->addAddress($toEmail, $toName);
        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body = $htmlBody;
        $mail->AltBody = $textBody;

        $mail->send();
        return ['success' => true, 'error' => null];
    } catch (Exception $e) {
        return ['success' => false, 'error' => $mail->ErrorInfo ?? $e->getMessage()];
    }
}
