<?php
/**
 * Fix item_status for items that don't have it set to 'Active'
 * Run this after migrate_data.php if items aren't showing up on the home page
 */

header('Content-Type: application/json');
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/../security/security.php';

$conn = db();

try {
    // Check if item_status column exists
    $checkColumn = $conn->query("SHOW COLUMNS FROM INVENTORY LIKE 'item_status'");
    if ($checkColumn->num_rows === 0) {
        echo json_encode([
            'success' => false,
            'message' => 'item_status column does not exist. Please run migration 011_add_item_status.sql first.'
        ]);
        exit;
    }

    // Update items that don't have item_status = 'Active' and are not sold
    $updateSql = "
        UPDATE INVENTORY 
        SET item_status = 'Active' 
        WHERE (item_status IS NULL OR item_status = '' OR item_status != 'Active')
          AND (sold = 0 OR sold IS NULL)
    ";
    
    $result = $conn->query($updateSql);
    
    if (!$result) {
        throw new Exception("Update failed: " . $conn->error);
    }
    
    $affectedRows = $conn->affected_rows;
    
    // Also check for items that might have item_status but are NULL or empty
    $checkSql = "
        SELECT COUNT(*) as count 
        FROM INVENTORY 
        WHERE (item_status IS NULL OR item_status = '' OR item_status != 'Active')
          AND (sold = 0 OR sold IS NULL)
    ";
    
    $checkResult = $conn->query($checkSql);
    $remaining = 0;
    if ($checkResult) {
        $row = $checkResult->fetch_assoc();
        $remaining = (int)$row['count'];
    }
    
    echo json_encode([
        'success' => true,
        'message' => "Updated $affectedRows items to 'Active' status.",
        'affected_rows' => $affectedRows,
        'remaining_inactive' => $remaining
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . escapeHtml($e->getMessage())
    ]);
}

