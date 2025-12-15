<?php

declare(strict_types=1);

// Include bootstrap and helpers
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../utility/email_helpers.php';
require_once __DIR__ . '/../utility/email_templates.php';

// Bootstrap API with GET and POST methods, authentication required
$result = api_bootstrap(['GET', 'POST'], true);
$userId = $result['userId'];
$conn = $result['conn'];
$method = $_SERVER['REQUEST_METHOD'];

// Helpers
function getPrefs(mysqli $conn, int $userId)
{
  $stmt = $conn->prepare('SELECT theme, promotional, reveal_contact_info, interested_category_1, interested_category_2, interested_category_3 FROM user_accounts WHERE user_id = ?');
  if (!$stmt) {
    throw new RuntimeException('Failed to prepare query');
  }
  $stmt->bind_param('i', $userId);
  if (!$stmt->execute()) {
    $stmt->close();
    throw new RuntimeException('Failed to execute query');
  }
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

/**
 * Send promotional welcome email
 * 
 * @param array $user User data with firstName, lastName, email
 * @return array Result array with 'ok' (bool) and 'error' (string|null)
 */
function sendPromoWelcomeEmail(array $user): array {
    $firstName = $user['firstName'] ?? 'Student';
    $lastName = $user['lastName'] ?? '';
    $email = $user['email'] ?? '';
    
    $template = get_promo_welcome_email_template($firstName);
    $toName = trim($firstName . ' ' . $lastName);
    
    $result = send_email($email, $toName, $template['subject'], $template['html'], $template['text']);
    
    // Convert 'success' key to 'ok' for backward compatibility
    return [
        'ok' => $result['success'],
        'error' => $result['error']
    ];
}

try {
  if ($method === 'GET') {
    $data = getPrefs($conn, $userId);
    send_json_success(['data' => $data]);
  }

  if ($method === 'POST') {
    $body = get_request_data();
    if (!is_array($body)) {
        send_json_error(400, 'Invalid JSON body');
    }

    /* Conditional CSRF validation - only validate if token is provided */
    validate_csrf_optional($body);

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
      if (!$stmt) {
        throw new RuntimeException('Failed to prepare query');
      }
      $stmt->bind_param('i', $userId);
      if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to execute query');
      }
      $res = $stmt->get_result();
      $userRow = $res->fetch_assoc();
      $stmt->close();
      
      // Debug logging
      if ($userRow && !$userRow['received_intro_promo_email']) {
        $shouldSendEmail = true;
      }
    }

    $stmt = $conn->prepare('UPDATE user_accounts SET theme = ?, promotional = ?, reveal_contact_info = ?, interested_category_1 = ?, interested_category_2 = ?, interested_category_3 = ? WHERE user_id = ?');
    if (!$stmt) {
      throw new RuntimeException('Failed to prepare update');
    }
    $stmt->bind_param('iiisssi', $theme, $promo, $reveal, $int1, $int2, $int3, $userId);
    if (!$stmt->execute()) {
      $stmt->close();
      throw new RuntimeException('Failed to update user preferences');
    }
    $stmt->close();

    if ($shouldSendEmail) {
      $stmt2 = $conn->prepare('UPDATE user_accounts SET received_intro_promo_email = 1 WHERE user_id = ?');
      if ($stmt2) {
        $stmt2->bind_param('i', $userId);
        $stmt2->execute();
        $stmt2->close();
      }
    }

    if ($shouldSendEmail) {
      $stmt = $conn->prepare('SELECT first_name, last_name, email FROM user_accounts WHERE user_id = ?');
      if (!$stmt) {
        throw new RuntimeException('Failed to prepare user details query');
      }
      $stmt->bind_param('i', $userId);
      if (!$stmt->execute()) {
        $stmt->close();
        throw new RuntimeException('Failed to fetch user details');
      }
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

    send_json_success();
  }
} catch (Throwable $e) {
  error_log('userPreferences error: ' . $e->getMessage());
  send_json_error(500, 'Server error');
}
