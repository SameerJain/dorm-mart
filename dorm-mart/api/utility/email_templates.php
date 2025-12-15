<?php

declare(strict_types=1);

/**
 * Email Template Functions
 * 
 * Centralized email template generation functions
 */

require_once __DIR__ . '/../security/security.php';

/**
 * Get welcome email template (for new account creation)
 * 
 * @param string $firstName User's first name
 * @param string $tempPassword Temporary password
 * @return array ['html' => string, 'text' => string, 'subject' => string]
 */
function get_welcome_email_template(string $firstName, string $tempPassword): array {
    // XSS PROTECTION: Encoding (Layer 2) - HTML entity encoding
    $firstEscaped = escapeHtml($firstName ?: 'Student');
    $tempPasswordEscaped = escapeHtml($tempPassword);
    $subject = 'Welcome to Dorm Mart';

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
      <p style="color:#eee;">Dear {$firstEscaped},</p>
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

    $firstPlain = $firstName ?: 'Student';
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

    return [
        'html' => $html,
        'text' => $text,
        'subject' => $subject
    ];
}

/**
 * Get password reset email template
 * 
 * @param string $firstName User's first name
 * @param string $resetLink Password reset link
 * @return array ['html' => string, 'text' => string, 'subject' => string]
 */
function get_password_reset_email_template(string $firstName, string $resetLink): array {
    // XSS PROTECTION: Encoding (Layer 2) - HTML entity encoding
    $firstNameEscaped = escapeHtml($firstName ?: 'Student');
    $resetLinkEscaped = escapeHtml($resetLink);
    $subject = 'Reset Your Password - Dorm Mart';

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
      <p style="color:#eee;">Dear {$firstNameEscaped},</p>
      <p style="color:#eee;">You requested to reset your password for your Dorm Mart account.</p>
      <p style="margin:20px 0;">
        <a href="{$resetLinkEscaped}" style="background:#007bff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Reset Password</a>
      </p>
      <p style="color:#eee;">This link will expire in 1 hour for security reasons.</p>
      <p style="color:#eee;">Best regards,<br/>The Dorm Mart Team</p>
      <hr style="border:none;border-top:1px solid #333;margin:16px 0;">
      <p style="font-size:12px;color:#aaa;">This is an automated message; do not reply. For support:
      <a href="mailto:dormmartsupport@gmail.com" style="color:#9db7ff;">dormmartsupport@gmail.com</a></p>
    </div>
  </body>
</html>
HTML;

    $firstNamePlain = $firstName ?: 'Student';
    $text = <<<TEXT
Dear {$firstNamePlain},

You requested to reset your password for your Dorm Mart account.

Click this link to reset your password:
{$resetLink}

This link will expire in 1 hour for security reasons.

Best regards,
The Dorm Mart Team

(This is an automated message; do not reply. Support: dormmartsupport@gmail.com)
TEXT;

    return [
        'html' => $html,
        'text' => $text,
        'subject' => $subject
    ];
}

/**
 * Get promotional welcome email template
 * 
 * @param string $firstName User's first name
 * @return array ['html' => string, 'text' => string, 'subject' => string]
 */
function get_promo_welcome_email_template(string $firstName): array {
    // XSS PROTECTION: Encoding (Layer 2) - HTML entity encoding
    $firstEscaped = escapeHtml($firstName ?: 'Student');
    $subject = 'Welcome to Dorm Mart Promotional Updates';

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
      
      <p style="color:#eee;font-size:16px;margin:0 0 16px 0;">Dear {$firstEscaped},</p>
      
      <p style="color:#eee;margin:0 0 20px 0;">Thank you for opting into promotional updates from <strong style="color:#2563EB;">Dorm Mart</strong>!</p>
      
      <div style="background:#2a2a2a;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #2563EB;">
        <p style="color:#eee;margin:0 0 12px 0;font-weight:bold;">You'll now receive updates about:</p>
        <ul style="color:#ddd;margin:0;padding-left:20px;">
          <li style="margin:6px 0;">Emails about your notifications tab</li>
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

    $firstPlain = $firstName ?: 'Student';
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

    return [
        'html' => $html,
        'text' => $text,
        'subject' => $subject
    ];
}
