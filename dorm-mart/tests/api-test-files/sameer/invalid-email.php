<?php
header('Content-Type: application/json; charset=utf-8');

// Test 4: Verify API endpoint returns error for non-existent email
// This test calls the REAL forgot-password API and checks if it returns the expected error

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (!isset($input['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email is required']);
    exit;
}

$email = $input['email'];

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !str_ends_with($email, '@buffalo.edu')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email must be a valid UB email address']);
    exit;
}

// Call the REAL forgot-password API to test actual functionality
$forgotPasswordUrl = 'https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/auth/forgot-password.php';

$postData = json_encode(['email' => $email]);

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => $postData
    ]
]);

$result = file_get_contents($forgotPasswordUrl, false, $context);

if ($result === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'error' => 'Failed to call forgot-password API',
        'test_result' => 'ERROR - API call failed'
    ]);
    exit;
}

$response = json_decode($result, true);

// Check if the API returned the expected error for non-existent email
if (isset($response['error']) && $response['error'] === 'Email not found') {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'error' => 'Email not found',
        'test_result' => 'PASS - API correctly returned email not found'
    ]);
} else {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'error' => 'API did not return expected response',
        'api_response' => $response,
        'test_result' => 'FAIL - API should have returned "Email not found"'
    ]);
}
