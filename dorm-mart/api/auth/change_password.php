<?php

declare(strict_types=1);

// Include security headers for XSS protection
require __DIR__ . '/../security/security.php';
setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
  exit;
}

require __DIR__ . '/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

auth_boot_session();
$userId = require_login();

/* Read body (JSON or form) - IMPORTANT: Do NOT HTML-encode passwords before hashing */
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($ct, 'application/json') !== false) {
  $raw  = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    $data = [];
  }
  // Passwords must remain raw - they're hashed, not displayed
  $current = isset($data['currentPassword']) ? (string)$data['currentPassword'] : '';
  $next    = isset($data['newPassword']) ? (string)$data['newPassword'] : '';
} else {
  // Passwords must remain raw - they're hashed, not displayed
  $current = isset($_POST['currentPassword']) ? (string)$_POST['currentPassword'] : '';
  $next    = isset($_POST['newPassword']) ? (string)$_POST['newPassword'] : '';
}

/* Validate inputs */
$MAX_LEN = 64;
if ($current === '' || $next === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing required fields']);
  exit;
}
if (strlen($current) > $MAX_LEN || strlen($next) > $MAX_LEN) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Entered password is too long']);
  exit;
}
if (
  strlen($next) < 8
  || !preg_match('/[a-z]/', $next)
  || !preg_match('/[A-Z]/', $next)
  || !preg_match('/\d/', $next)
  || !preg_match('/[^A-Za-z0-9]/', $next)
) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Password does not meet policy']);
  exit;
}

try {
  $conn = db();

  // ============================================================================
  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  // ============================================================================
  // Using prepared statement with '?' placeholder and bind_param() to safely
  // handle $userId. Even if malicious SQL is in $userId, it cannot execute
  // because it's bound as an integer parameter, not concatenated into SQL.
  // ============================================================================
  $stmt = $conn->prepare('SELECT hash_pass, email FROM user_accounts WHERE user_id = ? LIMIT 1');
  $stmt->bind_param('i', $userId);  // 'i' = integer type, safely bound as parameter
  $stmt->execute();
  $res = $stmt->get_result();

  if ($res->num_rows === 0) {
    $stmt->close();
    $conn->close();
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'User not found']);
    exit;
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
    $conn->close();
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Invalid current password']);
    exit;
  }

  /* Optional: reject reuse of the same password */
  if (password_verify($next, (string)$row['hash_pass'])) {
    $conn->close();
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'New password must differ from current']);
    exit;
  }

  // Block password change for testuser@buffalo.edu - return success but don't actually update
  if ($isTestUser) {
    $conn->close();
    // Return success without actually changing the password or destroying session
    echo json_encode(['ok' => true]);
    exit;
  }

  /* Update password; also clear any persisted token column if present
   * SECURITY NOTE: password_hash() automatically generates a random SALT and
   * returns a salted bcrypt hash. Only the hash is stored in the DB. */
  $newHash = password_hash($next, PASSWORD_BCRYPT);
  
  // ============================================================================
  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  // ============================================================================
  // The password hash and user_id are bound as parameters using bind_param().
  // This prevents SQL injection even if malicious SQL were in these values.
  // ============================================================================
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

  $conn->close();

  // End the session so the client must log in again (your UI already redirects)
  logout_destroy_session();

  echo json_encode(['ok' => true]);
} catch (Throwable $e) {
  if (isset($stmt) && $stmt) {
    $stmt->close();
  }
  if (isset($upd) && $upd) {
    $upd->close();
  }
  if (isset($conn) && $conn) {
    $conn->close();
  }
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Server error']);
}
