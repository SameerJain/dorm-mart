<?php
header('Content-Type: application/json; charset=utf-8');

// Test 3 - Invalid Password Requirements Test
// This test calls the REAL reset-password API and checks if it validates password requirements

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($input['token']) || !isset($input['new_password']) || !isset($input['re_new_password'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required fields: token, new_password, re_new_password'
    ]);
    exit;
}

$token = $input['token'];
$newPassword = $input['new_password'];
$reNewPassword = $input['re_new_password'];

// Call the REAL reset-password API to test actual functionality
$resetPasswordUrl = 'https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/auth/reset-password.php';

$postData = json_encode([
    'token' => $token,
    'new_password' => $newPassword,
    're_new_password' => $reNewPassword
]);

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => $postData
    ]
]);

$result = file_get_contents($resetPasswordUrl, false, $context);

if ($result === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'Failed to call reset-password API',
        'test_result' => 'ERROR - API call failed'
    ]);
    exit;
}

$response = json_decode($result, true);

// Check if the API returned the expected error for invalid password
if (isset($response['error']) && (strpos($response['error'], 'password') !== false || strpos($response['error'], 'requirements') !== false)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, number, and special character.',
        'test_result' => 'PASS - API correctly identified invalid password'
    ]);
} else {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'error' => 'API did not return expected response for invalid password',
        'api_response' => $response,
        'test_result' => 'FAIL - API should have returned password validation error'
    ]);
}
?>
