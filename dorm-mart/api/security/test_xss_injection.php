<?php
/**
 * XSS Injection Test Script
 * Tests various endpoints for XSS vulnerabilities
 * 
 * Usage: Run this script from command line or via web browser
 * Make sure you have valid session cookies for authenticated endpoints
 */

require_once __DIR__ . '/security.php';
setSecurityHeaders();

header('Content-Type: text/html; charset=utf-8');

// Test payloads for XSS
$xssPayloads = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "javascript:alert('XSS')",
    "<iframe src=javascript:alert('XSS')>",
    "<body onload=alert('XSS')>",
    "<input onfocus=alert('XSS') autofocus>",
    "<select onfocus=alert('XSS') autofocus>",
    "<textarea onfocus=alert('XSS') autofocus>",
    "<keygen onfocus=alert('XSS') autofocus>",
    "<video><source onerror=alert('XSS')>",
    "<audio src=x onerror=alert('XSS')>",
    "<details open ontoggle=alert('XSS')>",
    "<marquee onstart=alert('XSS')>",
    "<div onmouseover=alert('XSS')>",
    "<style>@import'javascript:alert(\"XSS\")';</style>",
    "<link rel=stylesheet href=javascript:alert('XSS')>",
    "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>",
    "<object data=javascript:alert('XSS')>",
    "<embed src=javascript:alert('XSS')>",
];

// Test endpoints
$testEndpoints = [
    [
        'name' => 'Create Message',
        'url' => '/api/chat/create_message.php',
        'method' => 'POST',
        'data' => ['receiver_id' => '1', 'content' => '', 'conv_id' => null],
        'field' => 'content'
    ],
    [
        'name' => 'Submit Review',
        'url' => '/api/reviews/submit_review.php',
        'method' => 'POST',
        'data' => ['product_id' => 1, 'rating' => 5, 'product_rating' => 5, 'review_text' => ''],
        'field' => 'review_text'
    ],
    [
        'name' => 'Product Listing (Title)',
        'url' => '/api/seller-dashboard/product_listing.php',
        'method' => 'POST',
        'data' => ['mode' => 'create', 'title' => '', 'description' => 'Test', 'price' => '10'],
        'field' => 'title'
    ],
    [
        'name' => 'Product Listing (Description)',
        'url' => '/api/seller-dashboard/product_listing.php',
        'method' => 'POST',
        'data' => ['mode' => 'create', 'title' => 'Test', 'description' => '', 'price' => '10'],
        'field' => 'description'
    ],
    [
        'name' => 'Update Profile (Bio)',
        'url' => '/api/profile/update_profile.php',
        'method' => 'POST',
        'data' => ['bio' => ''],
        'field' => 'bio'
    ],
    [
        'name' => 'Search Query',
        'url' => '/api/search/getSearchItems.php',
        'method' => 'POST',
        'data' => ['q' => ''],
        'field' => 'q'
    ],
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>XSS Injection Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
        .payload { font-family: monospace; background: #f9f9f9; padding: 2px 5px; }
    </style>
</head>
<body>
    <h1>XSS Injection Test Results</h1>
    <p class='info'>This script tests endpoints for XSS vulnerabilities. All endpoints should reject XSS attempts or properly escape output.</p>";

$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . 
           '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');

$totalTests = 0;
$passedTests = 0;

foreach ($testEndpoints as $endpoint) {
    echo "<div class='test-section'>";
    echo "<h2>{$endpoint['name']} ({$endpoint['field']})</h2>";
    
    foreach ($xssPayloads as $payload) {
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
            (isset($result['error']) && (
                stripos($result['error'], 'invalid') !== false ||
                stripos($result['error'], 'xss') !== false ||
                stripos($result['error'], 'characters') !== false
            ))) {
            $isSafe = true;
            $passedTests++;
        }
        
        $status = $isSafe ? "<span class='pass'>PASS</span>" : "<span class='fail'>FAIL</span>";
        echo "<p>{$status} Payload: <span class='payload'>" . htmlspecialchars($payload) . "</span></p>";
        
        if (!$isSafe) {
            echo "<pre>Response: " . htmlspecialchars(substr($response, 0, 500)) . "</pre>";
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
echo "<p class='info'><strong>Note:</strong> Even if an endpoint accepts XSS payloads, it may still be safe if output is properly escaped. Check the actual output rendering.</p>";
echo "</div>";

echo "</body>
</html>";
?>

