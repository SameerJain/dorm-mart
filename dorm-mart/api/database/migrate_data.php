<?php
header('Content-Type: application/json');                      // Return JSON to the client

// Include security utilities for escapeHtml function
require_once __DIR__ . '/../security/security.php';

require __DIR__ . '/db_connect.php';                            // Load your connection helper
$conn = db();                                                   // Get a mysqli connection

// Create (if missing) a table to record runs of each SQL file by filename
$conn->query("
  CREATE TABLE IF NOT EXISTS data_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");

// Copy test images from data/test-images/ to images/ directory with unique naming
$dataDir = dirname(__DIR__,2) . '/data';
$testImagesDir = $dataDir . '/test-images';
$imagesDir = dirname(__DIR__,2) . '/images';

if (is_dir($testImagesDir)) {
  if (!is_dir($imagesDir)) { @mkdir($imagesDir, 0775, true); }
  
  $testImageFiles = glob($testImagesDir . '/*');
  foreach ($testImageFiles as $testImagePath) {
    if (is_file($testImagePath)) {
      $origName = basename($testImagePath);
      $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
      $allowedExt = ['jpg','jpeg','png','webp','gif'];
      if (!in_array($ext, $allowedExt, true)) { $ext = 'jpg'; }
      
      // Use same unique naming as product listing form
      $fname = uniqid('img_', true) . '.' . $ext;
      $destPath = $imagesDir . '/' . $fname;
      
      if (!copy($testImagePath, $destPath)) {
        error_log("Warning: Failed to copy test image: $origName");
      }
    }
  }
}

// Collect all .sql files from ../data and sort them naturally (e.g., 1,2,10)
$files = glob($dataDir . '/*.sql');                             // List all .sql files
natsort($files);                                                // Sort numerically by names like 001, 010, etc.

$ran = [];                                                      // Keep track of executed filenames

// Run every file, regardless of past executions
foreach ($files as $path) {
  $name = basename($path);                                      // Extract filename only
  $sql  = file_get_contents($path);                             // Read the SQL script contents

  $conn->begin_transaction();                                   // Start an atomic transaction

  if (!$conn->multi_query($sql)) {                              // Execute possibly multi-statement SQL
    $err = $conn->error;                                        // Capture the MySQL error message
    $conn->rollback();                                          // Undo any partial changes
    // Note: No HTML encoding needed for JSON - React handles XSS protection
    echo json_encode([
      "success" => false,                       // Report failure (which file + why)
      "message" => "Failed: " . $name . " — " . $err
    ]);
    exit;                                                       // Stop on first failure
  }

  // Flush all result sets produced by multi_query to clear the connection for next use
  while ($conn->more_results() && $conn->next_result()) { /* flush */ }

  // Record that we ran this file; if it exists, just bump the timestamp
  $stmt = $conn->prepare(                                       // Use the tracking table we created above
    "INSERT INTO data_migrations (filename) VALUES (?)
     ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP"
  );
  if (!$stmt) {
    $err = $conn->error;
    $conn->rollback();
    echo json_encode([
      "success" => false,
      "message" => "Failed: " . $name . " — prepare failed: " . $err
    ]);
    exit;
  }
  $stmt->bind_param("s", $name);                                // Bind the filename as string
  if (!$stmt->execute()) {                                      // Insert or update the timestamp
    $err = $stmt->error;
    $stmt->close();
    $conn->rollback();
    echo json_encode([
      "success" => false,
      "message" => "Failed: " . $name . " — execute failed: " . $err
    ]);
    exit;
  }
  $stmt->close();                                               // Free the statement

  $conn->commit();
  $ran[] = $name;
}

// Clean up orphaned inventory entries for migrated test accounts only
$testEmailPatterns = [
  'testuser@buffalo.edu',
  'test-buyer@buffalo.edu',
  'test-seller@buffalo.edu',
  'test-change-password@buffalo.edu',
  'testuser102@buffalo.edu',
  'testuserschedulered@buffalo.edu',
  'testuserscheduleyellow@buffalo.edu'
];

// Get user_ids for test accounts
$testUserIds = [];
if (!empty($testEmailPatterns)) {
  $placeholders = implode(',', array_fill(0, count($testEmailPatterns), '?'));
  $cleanupStmt = $conn->prepare("SELECT user_id FROM user_accounts WHERE email IN ($placeholders)");
  if (!$cleanupStmt) {
    error_log("Failed to prepare test user ID fetch: " . $conn->error);
    $cleanupStmt = null;
  } else {
    $types = str_repeat('s', count($testEmailPatterns));
    $cleanupStmt->bind_param($types, ...$testEmailPatterns);
    if (!$cleanupStmt->execute()) {
      error_log("Failed to execute test user ID fetch: " . $cleanupStmt->error);
      $cleanupStmt->close();
      $cleanupStmt = null;
    } else {
      $result = $cleanupStmt->get_result();
      while ($row = $result->fetch_assoc()) {
        $testUserIds[] = (int)$row['user_id'];
      }
      $cleanupStmt->close();
    }
  }
}

// Delete inventory entries for test accounts
if (!empty($testUserIds)) {
  $placeholders = implode(',', array_fill(0, count($testUserIds), '?'));
  $deleteStmt = $conn->prepare("DELETE FROM INVENTORY WHERE seller_id IN ($placeholders)");
  if ($deleteStmt) {
    $types = str_repeat('i', count($testUserIds));
    $deleteStmt->bind_param($types, ...$testUserIds);
    if (!$deleteStmt->execute()) {
      error_log("Failed to delete test account inventory: " . $deleteStmt->error);
    }
    $deleteStmt->close();
  } else {
    error_log("Failed to prepare test account inventory delete: " . $conn->error);
  }
}

// Delete any truly orphaned inventory entries (seller_id not in user_accounts)
$orphanStmt = $conn->prepare("DELETE i FROM INVENTORY i LEFT JOIN user_accounts ua ON i.seller_id = ua.user_id WHERE ua.user_id IS NULL");
if ($orphanStmt) {
  if (!$orphanStmt->execute()) {
    error_log("Failed to delete orphaned inventory: " . $orphanStmt->error);
  }
  $orphanStmt->close();
} else {
  error_log("Failed to prepare orphaned inventory delete: " . $conn->error);
}

$escapedRan = array_map('escapeHtml', $ran);
echo json_encode(["success" => true, "applied" => $escapedRan]);
