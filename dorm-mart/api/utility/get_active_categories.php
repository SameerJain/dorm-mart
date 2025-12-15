<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../security/security.php';

// Bootstrap API with GET method (no auth required)
api_bootstrap('GET', false);
$conn = get_db();

try {
    
    // Query to get all categories from active, unsold items
    $sql = "
        SELECT DISTINCT categories 
        FROM INVENTORY 
        WHERE (sold = 0 OR sold IS NULL) 
        AND item_status = 'Active'
        AND categories IS NOT NULL
        AND categories != ''
    ";
    
    $result = $conn->query($sql);
    
    if ($result === false) {
        throw new RuntimeException('Query failed: ' . $conn->error);
    }
    
    // Aggregate all unique categories
    $categoriesSet = [];
    
    while ($row = $result->fetch_assoc()) {
        $categoriesJson = $row['categories'];
        if ($categoriesJson) {
            $decoded = json_decode($categoriesJson, true);
            if (is_array($decoded)) {
                foreach ($decoded as $category) {
                    if (is_string($category) && trim($category) !== '') {
                        $categoriesSet[trim($category)] = true;
                    }
                }
            }
        }
    }
    
    // Convert to array and sort alphabetically
    $categories = array_keys($categoriesSet);
    sort($categories, SORT_STRING | SORT_FLAG_CASE);
    
    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $escapedCategories = array_map('escapeHtml', $categories);
    
    $conn->close();
    
    // Return the array of active categories
    send_json_success($escapedCategories);

} catch (Throwable $e) {
    // XSS PROTECTION: Escape exception message to prevent XSS
    send_json_error(500, escapeHtml($e->getMessage()));
}

