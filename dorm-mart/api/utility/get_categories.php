<?php
declare(strict_types=1);

// CORS headers to allow frontend access
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Full path to categories.json in this same directory
    $filePath = __DIR__ . '/categories.json';

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode([
            'ok'    => false,
            'error' => 'categories.json file not found'
        ]);
        exit;
    }

    $json = file_get_contents($filePath);
    if ($json === false) {
        throw new RuntimeException('Unable to read categories.json');
    }

    $data = json_decode($json, true);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid JSON format in categories.json. Expected an array.');
    }
    
    // Remove "Misc." from array if it exists (to place it at the end)
    $miscIndex = array_search("Misc.", $data);
    $miscCategory = false;
    if ($miscIndex !== false) {
        $miscCategory = $data[$miscIndex];
        unset($data[$miscIndex]);
        $data = array_values($data); // Re-index array
    }
    
    // Sort alphabetically (A-Z) by the first letter of each element
    usort($data, function($a, $b) {
        return strcasecmp($a[0], $b[0]); // Compare first character case-insensitively
    });
    
    // Find "Utility" and place "Misc." right after it
    if ($miscCategory !== false) {
        $utilityIndex = array_search("Utility", $data);
        if ($utilityIndex !== false) {
            // Insert "Misc." after "Utility"
            array_splice($data, $utilityIndex + 1, 0, $miscCategory);
        } else {
            // If "Utility" not found, just append to end
            $data[] = $miscCategory;
        }
    }

    // ✅ success: just return the array
    echo json_encode($data);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => $e->getMessage()
    ]);
}
