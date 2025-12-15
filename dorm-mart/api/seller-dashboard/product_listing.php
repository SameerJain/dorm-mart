<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with POST method and authentication
// Note: This endpoint uses multipart/form-data for file uploads, so we handle $_POST/$_FILES directly
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
  $token = $_POST['csrf_token'] ?? null;
  if ($token !== null && !validate_csrf_token($token)) {
    send_json_error(403, 'CSRF token validation failed');
  }

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

  if ($titleRaw !== '' && containsXSSPattern($titleRaw)) {
    send_json_error(400, 'Invalid characters in title');
  }
  if ($descriptionRaw !== null && $descriptionRaw !== '' && containsXSSPattern($descriptionRaw)) {
    send_json_error(400, 'Invalid characters in description');
  }
  if ($itemLocationRaw !== null && $itemLocationRaw !== '' && containsXSSPattern($itemLocationRaw)) {
    send_json_error(400, 'Invalid characters in location');
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
    send_json_error(400, 'Validation failed', ['errors' => $errors]);
  }

  // --- Save images (no finfo) ---
  require_once __DIR__ . '/../utility/env_config.php';
  $API_ROOT = dirname(__DIR__);
  $envDir = get_env_var('DATA_IMAGES_DIR');
  $envBase = get_env_var('DATA_IMAGES_URL_BASE');
  $imageDirFs = rtrim($envDir ?: (dirname($API_ROOT) . '/images'), '/') . '/';
  $imageBaseUrl = rtrim($envBase ?: '/images', '/');
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
  if ($mode === 'update') {
    if ($itemId <= 0) {
      send_json_error(400, 'Invalid product ID. A valid product ID is required for updates.');
    }
    
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
    if (!$stmt) {
      send_json_error(500, 'Database error');
    }
    $stmt->bind_param(
      'ssssssdiiii',
      $title,
      $categoriesJson,
      $itemLocation,
      $itemCondition,
      $description,
      $photosJson,
      $price,
      $trades,
      $priceNego,
      $itemId,
      $userId
    );
    if (!$stmt->execute()) {
      $stmt->close();
      send_json_error(500, 'Database error');
    }

    if ($stmt->affected_rows === 0) {
      $stmt->close();
      send_json_error(404, 'Product not found or you do not have permission to edit this product.');
    }
    $stmt->close();

    send_json_success([
      'prod_id' => $itemId,
      'image_urls' => $imageUrls
    ]);
  }

  $sql = "INSERT INTO INVENTORY
            (title, categories, item_location, item_condition, description, photos, listing_price, item_status, trades, price_nego, seller_id)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  $stmt = $conn->prepare($sql);
  if (!$stmt) {
    send_json_error(500, 'Database error');
  }
  $status = 'Active';
  $stmt->bind_param(
    'ssssssdsiii',
    $title,
    $categoriesJson,
    $itemLocation,
    $itemCondition,
    $description,
    $photosJson,
    $price,
    $status,
    $trades,
    $priceNego,
    $userId
  );
  if (!$stmt->execute()) {
    $stmt->close();
    send_json_error(500, 'Database error');
  }

  $newProductId = (int)$conn->insert_id;
  $firstImageUrl = !empty($imageUrls) ? $imageUrls[0] : null;
  $wnSql = "INSERT INTO wishlist_notification (seller_id, product_id, title, image_url, unread_count)
            VALUES (?, ?, ?, ?, 0)";
  $wnStmt = $conn->prepare($wnSql);
  if ($wnStmt) {
    $wnStmt->bind_param('iiss', $userId, $newProductId, $title, $firstImageUrl);
    if ($wnStmt->execute()) {
      // Wishlist notification created
    }
    $wnStmt->close();
  }
  $stmt->close();

  send_json_success([
    'product_id' => $newProductId,
    'image_urls' => $imageUrls
  ]);

} catch (Throwable $e) {
  error_log('[productListing] ' . $e->getMessage() . "\n" . $e->getTraceAsString());
  send_json_error(500, 'Server error');
}
