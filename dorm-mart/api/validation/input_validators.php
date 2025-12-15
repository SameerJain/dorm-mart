<?php
/**
 * Input Validation Helper Functions
 * 
 * Provides reusable validation functions for common input patterns
 */

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

/**
 * Validate required fields in input array
 * Exits with 400 error if any required field is missing
 * 
 * @param array $input Input data array
 * @param array $requiredFields Array of required field names
 * @return void
 */
function validate_required_fields(array $input, array $requiredFields): void {
    $missing = [];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || $input[$field] === '' || $input[$field] === null) {
            $missing[] = $field;
        }
    }
    
    if (!empty($missing)) {
        send_json_error(400, 'Missing required fields: ' . implode(', ', $missing));
    }
}

/**
 * Validate email field
 * Exits with 400 error if invalid
 * 
 * @param array $input Input data array
 * @param string $fieldName Field name (default: 'email')
 * @return string Validated email address
 */
function validate_email_field(array $input, string $fieldName = 'email'): string {
    $email = trim((string)($input[$fieldName] ?? ''));
    
    if ($email === '') {
        send_json_error(400, "Missing or empty $fieldName");
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        send_json_error(400, "Invalid $fieldName format");
    }
    
    return strtolower($email);
}

/**
 * Validate integer field with optional min/max
 * Exits with 400 error if invalid
 * 
 * @param array $input Input data array
 * @param string $fieldName Field name
 * @param int $min Minimum value (default: PHP_INT_MIN)
 * @param int $max Maximum value (default: PHP_INT_MAX)
 * @return int Validated integer
 */
function validate_integer_field(array $input, string $fieldName, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX): int {
    if (!isset($input[$fieldName])) {
        send_json_error(400, "Missing field: $fieldName");
    }
    
    $value = (int)$input[$fieldName];
    
    if ($value < $min || $value > $max) {
        send_json_error(400, "Field $fieldName must be between $min and $max");
    }
    
    return $value;
}

/**
 * Validate string field with length constraints
 * Exits with 400 error if invalid
 * 
 * @param array $input Input data array
 * @param string $fieldName Field name
 * @param int $minLength Minimum length (default: 0)
 * @param int $maxLength Maximum length (default: 1000)
 * @return string Validated string
 */
function validate_string_length(array $input, string $fieldName, int $minLength = 0, int $maxLength = 1000): string {
    if (!isset($input[$fieldName])) {
        send_json_error(400, "Missing field: $fieldName");
    }
    
    $value = trim((string)$input[$fieldName]);
    $length = strlen($value);
    
    if ($length < $minLength) {
        send_json_error(400, "Field $fieldName must be at least $minLength characters");
    }
    
    if ($length > $maxLength) {
        send_json_error(400, "Field $fieldName must be at most $maxLength characters");
    }
    
    return $value;
}



