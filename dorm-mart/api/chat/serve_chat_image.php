<?php
declare(strict_types=1);

header('X-Content-Type-Options: nosniff'); // helps prevent MIME sniffing

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require __DIR__ . '/../database/db_connect.php';

setSecurityHeaders();    // your existing security headers
setSecureCORS();         // your existing CORS (same-site is fine for images)

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$conn = db();
$conn->set_charset('utf8mb4');

auth_boot_session();
$userId = require_login();                 // must be logged in

// --- inputs ---
$messageId = isset($_GET['message_id']) ? (int)$_GET['message_id'] : 0;
$forceDownload = isset($_GET['download']) && $_GET['download'] === '1';

if ($messageId <= 0) {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'bad_message_id']);
  exit;
}

// Verify the requester is a participant in the conversation that owns this message
// and fetch the stored image_url.
$sql = '
  SELECT m.image_url, m.conv_id, c.user1_id, c.user2_id
    FROM messages m
    JOIN conversations c ON c.conv_id = m.conv_id
   WHERE m.message_id = ?
   LIMIT 1
';
$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $messageId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
  http_response_code(404);
  echo json_encode(['success' => false, 'error' => 'not_found']);
  exit;
}

// Must be either user1 or user2 of that conversation
if ((int)$row['user1_id'] !== (int)$userId && (int)$row['user2_id'] !== (int)$userId) {
  http_response_code(403);
  echo json_encode(['success' => false, 'error' => 'forbidden']);
  exit;
}

$imageRel = (string)($row['image_url'] ?? '');
if ($imageRel === '') {
  http_response_code(404);
  echo json_encode(['success' => false, 'error' => 'no_image']);
  exit;
}

// Build absolute path safely from project root.
// __DIR__ = api/chat → dirname(__DIR__, 2) = project root (dorm-mart/)
$projectRoot = dirname(__DIR__, 2);
$absPath     = realpath($projectRoot . $imageRel);  // resolves symlinks/.. segments

// Security: ensure the resolved path is still under the media directory we expect
$mediaRoot = realpath($projectRoot . '/media/chat-images');
if (!$absPath || !$mediaRoot || strpos($absPath, $mediaRoot) !== 0 || !is_file($absPath)) {
  http_response_code(404);
  echo json_encode(['success' => false, 'error' => 'file_missing']);
  exit;
}

// Detect MIME type from file bytes (prevents spoofing)
$finfo = new finfo(FILEINFO_MIME_TYPE);              // requires php-fileinfo extension
$mime  = $finfo->file($absPath) ?: 'application/octet-stream';

// Optional: allow only image/* to be served here
if (strpos($mime, 'image/') !== 0) {
  http_response_code(415);
  echo json_encode(['success' => false, 'error' => 'unsupported_mime']);
  exit;
}

// Set headers for inline view or download
$basename = basename($absPath);                      // safe filename for header
header('Content-Type: ' . $mime);                    // tells the browser the exact type
header('Content-Length: ' . (string)filesize($absPath));
header('Cache-Control: private, max-age=604800');    // cache 7 days for the same user/session
header('Content-Disposition: ' . ($forceDownload ? 'attachment' : 'inline') . '; filename="' . $basename . '"');

// Stream the file; no echoing JSON afterward.
readfile($absPath);
exit;
