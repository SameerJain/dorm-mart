<?php
/**
 * SQL Injection Test Script
 * Tests various endpoints for SQL injection vulnerabilities
 * 
 * Usage: Run this script from command line or via web browser
 * Make sure you have valid session cookies for authenticated endpoints
 */

require_once __DIR__ . '/security.php';
setSecurityHeaders();

header('Content-Type: text/html; charset=utf-8');

// Test payloads for SQL injection
$sqlPayloads = [
    "' OR '1'='1",
    "' OR '1'='1'--",
    "'; DROP TABLE users--",
    "' UNION SELECT NULL--",
    "' UNION SELECT password FROM users--",
    "1' OR '1'='1",
    "1' OR 1=1--",
    "admin'--",
    "' OR 1=1#",
    "') OR ('1'='1",
    "1' OR '1'='1' /*",
    "1' OR '1'='1' --",
    "1' OR '1'='1' #",
    "1' OR '1'='1' UNION SELECT NULL--",
    "1' OR '1'='1' UNION SELECT password FROM users--",
];

// Test endpoints
$testEndpoints = [
    [
        'name' => 'Login',
        'url' => '/api/auth/login.php',
        'method' => 'POST',
        'data' => ['email' => 'test@buffalo.edu', 'password' => 'test123'],
        'field' => 'email'
    ],
    [
        'name' => 'Search',
        'url' => '/api/search/getSearchItems.php',
        'method' => 'POST',
        'data' => ['q' => '', 'category' => ''],
        'field' => 'q'
    ],
    [
        'name' => 'Product Listing (Title)',
        'url' => '/api/seller-dashboard/product_listing.php',
        'method' => 'POST',
        'data' => ['mode' => 'create', 'title' => '', 'description' => 'Test', 'price' => '10'],
        'field' => 'title'
    ],
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>SQL Injection Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>SQL Injection Test Results</h1>
    <p class='info'>This script tests endpoints for SQL injection vulnerabilities. All endpoints should reject SQL injection attempts.</p>";

$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . 
           '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');

$totalTests = 0;
$passedTests = 0;

foreach ($testEndpoints as $endpoint) {
    echo "<div class='test-section'>";
    echo "<h2>{$endpoint['name']} ({$endpoint['field']})</h2>";
    
    foreach ($sqlPayloads as $payload) {
        $totalTests++;
        $testData = $endpoint['data'];
        $testData[$endpoint['field']] = $payload;
        
        $ch = curl_init($baseUrl . $endpoint['url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, $endpoint['method'] === 'POST');
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($testData));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_COOKIEJAR, '/tmp/test_cookies.txt');
        curl_setopt($ch, CURLOPT_COOKIEFILE, '/tmp/test_cookies.txt');
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $result = json_decode($response, true);
        $isSafe = false;
        
        // Check if endpoint rejected the payload (error response or validation failure)
        if ($httpCode >= 400 || 
            (isset($result['ok']) && $result['ok'] === false) ||
            (isset($result['success']) && $result['success'] === false) ||
            (isset($result['error']) && stripos($result['error'], 'invalid') !== false)) {
            $isSafe = true;
            $passedTests++;
        }
        
        $status = $isSafe ? "<span class='pass'>PASS</span>" : "<span class='fail'>FAIL</span>";
        echo "<p>{$status} Payload: <code>" . htmlspecialchars($payload) . "</code></p>";
        
        if (!$isSafe) {
            echo "<pre>Response: " . htmlspecialchars($response) . "</pre>";
        }
    }
    
    echo "</div>";
}

$passRate = $totalTests > 0 ? round(($passedTests / $totalTests) * 100, 2) : 0;

echo "<div class='test-section'>";
echo "<h2>Summary</h2>";
echo "<p>Total Tests: {$totalTests}</p>";
echo "<p>Passed: <span class='pass'>{$passedTests}</span></p>";
echo "<p>Failed: <span class='fail'>" . ($totalTests - $passedTests) . "</span></p>";
echo "<p>Pass Rate: {$passRate}%</p>";
echo "</div>";

echo "</body>
</html>";
?>

