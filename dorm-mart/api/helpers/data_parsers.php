<?php
/**
 * Data Parsing Helper Functions
 * 
 * Provides reusable functions for parsing common data structures
 * like JSON photos, categories, etc.
 */

declare(strict_types=1);

/**
 * Parse photos JSON string into array
 * 
 * @param string|null $photosJson JSON string containing photos array
 * @return array Array of photo URLs
 */
function parse_photos_json(?string $photosJson): array {
    if (empty($photosJson)) {
        return [];
    }
    
    $decoded = json_decode($photosJson, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        return $decoded;
    }
    
    return [];
}

/**
 * Get first photo URL from photos JSON
 * 
 * @param string|null $photosJson JSON string containing photos array
 * @return string|null First photo URL or null if none
 */
function get_first_photo(?string $photosJson): ?string {
    $photos = parse_photos_json($photosJson);
    return !empty($photos) && is_array($photos) ? ($photos[0] ?? null) : null;
}

/**
 * Parse categories JSON string into array
 * Filters out empty strings and non-string values
 * 
 * @param string|null $categoriesJson JSON string containing categories array
 * @return array Array of category strings
 */
function parse_categories_json(?string $categoriesJson): array {
    if (empty($categoriesJson)) {
        return [];
    }
    
    $decoded = json_decode($categoriesJson, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        return array_values(array_filter($decoded, fn($v) => is_string($v) && $v !== ''));
    }
    
    return [];
}



