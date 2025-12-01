<?php
declare(strict_types=1);

// --- Optional debug: .../productListing.php?debug=1 ---
$DEBUG = true;
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

// Always return JSON
header('Content-Type: application/json; charset=utf-8');

try {
  // Resolve API root (this file: /api/seller-dashboard/productListing.php)
  $API_ROOT = dirname(__DIR__); // => /api

  // Security
  require $API_ROOT . '/security/security.php';
  initSecurity();

  // CORS / method
  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok'=>false,'error'=>'Method Not Allowed']);
    exit;
  }

  // Auth + DB
  require $API_ROOT . '/auth/auth_handle.php';
  require $API_ROOT . '/database/db_connect.php';

  auth_boot_session();
  $userId = require_login();

  /* Conditional CSRF validation - only validate if token is provided */
  $token = $_POST['csrf_token'] ?? null;
  if ($token !== null && !validate_csrf_token($token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'CSRF token validation failed']);
    exit;
  }

  mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
  $conn = db();
  $conn->set_charset('utf8mb4');

  // --- Read FormData ---
  $mode   = isset($_POST['mode']) ? trim((string)$_POST['mode']) : 'create';   // 'create' | 'update'
  $itemId = isset($_POST['id']) ? (int)$_POST['id'] : 0;

  $titleRaw = isset($_POST['title']) ? trim((string)$_POST['title']) : '';

  // Accept new categories[] or legacy tags[]
  $catsRaw = $_POST['categories'] ?? ($_POST['tags'] ?? []);
  $catsArr = is_array($catsRaw) ? $catsRaw : [$catsRaw];
  $catsArr = array_values(array_filter(array_map('trim', $catsArr), fn($v)=>$v!==''));
  // Enforce max 3 categories
  if (count($catsArr) > 3) { $catsArr = array_slice($catsArr, 0, 3); }

  // Accept new itemLocation or legacy meetLocation
  $itemLocationRaw  = (($t = ($_POST['itemLocation'] ?? ($_POST['meetLocation'] ?? ''))) !== '') ? trim((string)$t) : null;

  // Item condition
  $itemCondition = (($t = $_POST['condition'] ?? '') !== '') ? trim((string)$t) : null;

  $descriptionRaw = (($t = $_POST['description'] ?? '') !== '') ? trim((string)$t) : null;

  // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
  // Note: SQL injection prevented by prepared statements
  if ($titleRaw !== '' && containsXSSPattern($titleRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid characters in title']);
    exit;
  }
  // XSS PROTECTION: Filtering (Layer 1)
  if ($descriptionRaw !== null && $descriptionRaw !== '' && containsXSSPattern($descriptionRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid characters in description']);
    exit;
  }
  // XSS PROTECTION: Filtering (Layer 1)
  if ($itemLocationRaw !== null && $itemLocationRaw !== '' && containsXSSPattern($itemLocationRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid characters in location']);
    exit;
  }

  $title = $titleRaw;
  $description = $descriptionRaw;
  $itemLocation = $itemLocationRaw;

  $priceStr  = isset($_POST['price']) ? (string)$_POST['price'] : '';
  $price     = ($priceStr !== '' && is_numeric($priceStr)) ? (float)$priceStr : 0.0;

  $trades    = isset($_POST['acceptTrades'])    ? (int)$_POST['acceptTrades']    : 0; // 0/1
  $priceNego = isset($_POST['priceNegotiable']) ? (int)$_POST['priceNegotiable'] : 0; // 0/1

  // --- Validation ---
  $errors = [];
  if ($title === '')                                     { $errors['title'] = 'Title is required.'; }
  if ($description === null || $description === '')      { $errors['description'] = 'Description is required.'; }
  if ($priceStr === '' || !is_numeric($priceStr) || $price <= 0.0) {
    $errors['price'] = 'Price must be a positive number.';
  }
  if ($price > 9999.99) {
    $errors['price'] = 'Price must be $9999.99 or less.';
  }
  if (empty($catsArr))                                   { $errors['categories'] = 'Select at least one category.'; }
  if ($itemLocation === null || $itemLocation === '' || $itemLocation === '<Select Option>') {
    $errors['itemLocation'] = 'Select an item location.';
  }
  if ($itemCondition === null || $itemCondition === '' || $itemCondition === '<Select Option>') {
    $errors['condition'] = 'Select an item condition.';
  }

  if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['ok'=>false, 'error'=>'Validation failed', 'errors'=>$errors]);
    exit;
  }

  // --- Save images (no finfo) ---
  // Configurable via env so deployments under subpaths (e.g., Aptitude) work
  $envDir  = getenv('DATA_IMAGES_DIR');
  $envBase = getenv('DATA_IMAGES_URL_BASE');
  $imageDirFs   = rtrim($envDir !== false && $envDir !== '' ? $envDir : (dirname($API_ROOT) . '/images'), '/') . '/';
  $imageBaseUrl = rtrim($envBase !== false && $envBase !== '' ? $envBase : '/images', '/');
  if (!is_dir($imageDirFs)) { @mkdir($imageDirFs, 0775, true); }

  // Handle existing photos for edit mode
  $existingPhotos = [];
  if ($mode === 'update' && $itemId > 0) {
    // Accept existingPhotos[] from POST (can be array or single value)
    $existingPhotosRaw = $_POST['existingPhotos'] ?? [];
    if (is_array($existingPhotosRaw)) {
      $existingPhotos = array_values(array_filter(array_map('trim', $existingPhotosRaw), fn($v) => $v !== ''));
    } elseif (is_string($existingPhotosRaw) && $existingPhotosRaw !== '') {
      $existingPhotos = [trim($existingPhotosRaw)];
    }
    // Limit existing photos to max 6 total
    if (count($existingPhotos) > 6) {
      $existingPhotos = array_slice($existingPhotos, 0, 6);
    }
  }

  // Process new image uploads
  $newImageUrls = [];
  if (!empty($_FILES['images']) && is_array($_FILES['images']['tmp_name'])) {
    $maxFiles   = 6;
    $maxSizeB   = 5 * 1024 * 1024; // 5MB
    $allowedExt = ['jpg','jpeg','png','webp','gif'];
    $cnt = 0;

    foreach ($_FILES['images']['tmp_name'] as $i => $tmpPath) {
      if ($cnt >= $maxFiles) break;
      if (($_FILES['images']['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
      if (!is_uploaded_file($tmpPath)) continue;

      $sz = @filesize($tmpPath);
      if ($sz !== false && $sz > $maxSizeB) continue;

      $origName = (string)($_FILES['images']['name'][$i] ?? '');
      $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
      if (!in_array($ext, $allowedExt, true)) { $ext = 'jpg'; }

      $fname = uniqid('img_', true) . '.' . $ext;
      if (move_uploaded_file($tmpPath, $imageDirFs . $fname)) {
        $newImageUrls[] = $imageBaseUrl . '/' . $fname;
        $cnt++;
      }
    }
  }

  // Merge existing photos with new uploads (limit total to 6)
  $imageUrls = array_merge($existingPhotos, $newImageUrls);
  if (count($imageUrls) > 6) {
    $imageUrls = array_slice($imageUrls, 0, 6);
  }

  // --- JSON columns ---
  $categoriesJson = !empty($catsArr)   ? json_encode($catsArr, JSON_UNESCAPED_SLASHES)   : null;
  $photosJson     = !empty($imageUrls) ? json_encode($imageUrls, JSON_UNESCAPED_SLASHES) : null;

  // --- Create / Update ---
  if ($mode === 'update' && $itemId > 0) {
    // ============================================================================
    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    // ============================================================================
    // All user input (title, description, itemLocation, etc.) is bound as parameters.
    // The '?' placeholders ensure user input is treated as data, not executable SQL.
    // This prevents SQL injection attacks even if malicious SQL code is in any field.
    // ============================================================================
    $sql = "UPDATE INVENTORY
               SET title=?,
                   categories=?,
                   item_location=?,
                   item_condition=?,
                   description=?,
                   photos=?,
                   listing_price=?,
                   trades=?,
                   price_nego=?
             WHERE product_id=? AND seller_id=?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
      'ssssssdiiii',
      $title,            // safely bound as string parameter
      $categoriesJson,   // safely bound as string parameter
      $itemLocation,     // safely bound as string parameter
      $itemCondition,    // safely bound as string parameter
      $description,      // safely bound as string parameter
      $photosJson,       // safely bound as string parameter
      $price,            // safely bound as double parameter
      $trades,           // safely bound as integer parameter
      $priceNego,        // safely bound as integer parameter
      $itemId,           // safely bound as integer parameter
      $userId            // safely bound as integer parameter
    );
    $stmt->execute();

    echo json_encode([
      'ok'         => true,
      'prod_id' => $itemId,
      'image_urls' => $imageUrls
    ]);
    exit;
  }

  // INSERT
  // ============================================================================
  // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
  // ============================================================================
  // All user input is inserted using prepared statement with parameter binding.
  // The '?' placeholders ensure user input is treated as data, not executable SQL.
  // This prevents SQL injection attacks even if malicious SQL code is in any field.
  // ============================================================================
  $sql = "INSERT INTO INVENTORY
            (title, categories, item_location, item_condition, description, photos, listing_price, item_status, trades, price_nego, seller_id)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  $stmt = $conn->prepare($sql);
  $status = 'Active';
  $stmt->bind_param(
    'ssssssdsiii',
    $title,            // safely bound as string parameter
    $categoriesJson,   // safely bound as string parameter
    $itemLocation,     // safely bound as string parameter
    $itemCondition,   // safely bound as string parameter
    $description,      // safely bound as string parameter
    $photosJson,       // safely bound as string parameter
    $price,            // safely bound as double parameter
    $status,           // hardcoded value (safe)
    $trades,           // safely bound as integer parameter
    $priceNego,        // safely bound as integer parameter
    $userId            // safely bound as integer parameter
  );
  $stmt->execute();

  // Create wishlist_notification row for this new listing
  $newProductId = (int)$conn->insert_id;
  $firstImageUrl = !empty($imageUrls) ? $imageUrls[0] : null;  // first image or null
  $wnSql = "INSERT INTO wishlist_notification (seller_id, product_id, title, image_url, unread_count)
            VALUES (?, ?, ?, ?, 0)";
  $wnStmt = $conn->prepare($wnSql);
  $wnStmt->bind_param('iiss', $userId, $newProductId, $title, $firstImageUrl);
  $wnStmt->execute();

  echo json_encode([
    'ok'         => true,
    'product_id' => $conn->insert_id,
    'image_urls' => $imageUrls
  ]);

} catch (Throwable $e) {
  error_log('[productListing] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
  http_response_code(500);
  // XSS PROTECTION: Escape error message to prevent XSS if it contains user input
  // SECURITY: In production, consider removing detailed error fields to prevent information disclosure
  echo json_encode([
    'ok'    => false,
    'error' => $DEBUG ? escapeHtml($e->getMessage()) : 'Internal Server Error',
    'type'  => $DEBUG ? escapeHtml(get_class($e)) : null,
    'trace' => $DEBUG ? escapeHtml($e->getTraceAsString()) : null,
  ]);
}
