<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/auth_handle.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

/* Read body (JSON or form) - IMPORTANT: Do NOT HTML-encode passwords before hashing */
$data = get_request_data();
// Passwords must remain raw - they're hashed, not displayed
$current = isset($data['currentPassword']) ? (string)$data['currentPassword'] : '';
$next    = isset($data['newPassword']) ? (string)$data['newPassword'] : '';

/* Validate inputs */
$MAX_LEN = 64;
if ($current === '' || $next === '') {
  send_json_error(400, 'Missing required fields');
}
if (strlen($current) > $MAX_LEN || strlen($next) > $MAX_LEN) {
  send_json_error(400, 'Entered password is too long');
}
if (
  strlen($next) < 8
  || !preg_match('/[a-z]/', $next)
  || !preg_match('/[A-Z]/', $next)
  || !preg_match('/\d/', $next)
  || !preg_match('/[^A-Za-z0-9]/', $next)
) {
  send_json_error(400, 'Password does not meet policy');
}

try {
  $stmt = $conn->prepare('SELECT hash_pass, email FROM user_accounts WHERE user_id = ? LIMIT 1');
  $stmt->bind_param('i', $userId);
  $stmt->execute();
  $res = $stmt->get_result();

  if ($res->num_rows === 0) {
    $stmt->close();
    send_json_error(404, 'User not found');
  }

  $row = $res->fetch_assoc();
  $stmt->close();
  
  // Block password change for testuser@buffalo.edu
  $userEmail = (string)($row['email'] ?? '');
  $isTestUser = ($userEmail === 'testuser@buffalo.edu');

  /* Verify current password
   * SECURITY NOTE: password_verify() compares the user-provided
   * plaintext to the STORED salted hash. The salt and algorithm params are
   * embedded inside the hash created by password_hash() when the user/account
   * was created or changed. We never compare against or store plaintext. */
  if (!password_verify($current, (string)$row['hash_pass'])) {
    send_json_error(401, 'Invalid current password');
  }

  /* Optional: reject reuse of the same password */
  if (password_verify($next, (string)$row['hash_pass'])) {
    send_json_error(400, 'New password must differ from current');
  }

  // Block password change for testuser@buffalo.edu - return success but don't actually update
  if ($isTestUser) {
    // Return success without actually changing the password or destroying session
    send_json_success();
  }

  /* Update password; also clear any persisted token column if present
   * SECURITY NOTE: password_hash() automatically generates a random SALT and
   * returns a salted bcrypt hash. Only the hash is stored in the DB. */
  $newHash = password_hash($next, PASSWORD_BCRYPT);
  
  $upd = $conn->prepare('UPDATE user_accounts SET hash_pass = ?, hash_auth = NULL WHERE user_id = ?');
  $upd->bind_param('si', $newHash, $userId);  // 's' = string, 'i' = integer
  $upd->execute();
  $upd->close();

  /* Rotate session id and log out to force re-auth */
  session_regenerate_id(true);
  // Clear auth_token cookie if your schema still has it (harmless if absent)
  if (isset($_COOKIE['auth_token'])) {
    setcookie('auth_token', '', [
      'expires'  => time() - 3600,
      'path'     => '/',
      'httponly' => true,
      'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
      'samesite' => 'Lax'
    ]);
  }

  // End the session so the client must log in again (your UI already redirects)
  logout_destroy_session();

  send_json_success();
} catch (Throwable $e) {
  if (isset($stmt) && $stmt) {
    $stmt->close();
  }
  if (isset($upd) && $upd) {
    $upd->close();
  }
  error_log('change_password error: ' . $e->getMessage());
  send_json_error(500, 'Server error');
}
