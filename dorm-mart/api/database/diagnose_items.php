<?php
/**
 * Diagnostic script to check why items aren't showing on the home page
 */

header('Content-Type: application/json');
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/../security/security.php';

$conn = db();

try {
    // Check total items
    $totalResult = $conn->query("SELECT COUNT(*) as total FROM INVENTORY");
    $totalRow = $totalResult->fetch_assoc();
    $totalItems = (int)$totalRow['total'];
    
    // Check items that should show (not sold, active status)
    $activeResult = $conn->query("
        SELECT COUNT(*) as count 
        FROM INVENTORY 
        WHERE (sold = 0 OR sold IS NULL)
          AND (item_status = 'Active' OR item_status IS NULL OR item_status = '')
    ");
    $activeRow = $activeResult->fetch_assoc();
    $activeItems = (int)$activeRow['count'];
    
    // Check items by status
    $statusResult = $conn->query("
        SELECT 
            COALESCE(item_status, 'NULL') as status,
            COUNT(*) as count
        FROM INVENTORY
        GROUP BY item_status
    ");
    $statusBreakdown = [];
    while ($row = $statusResult->fetch_assoc()) {
        $statusBreakdown[$row['status']] = (int)$row['count'];
    }
    
    // Check items by sold status
    $soldResult = $conn->query("
        SELECT 
            CASE 
                WHEN sold = 1 THEN 'sold'
                WHEN sold = 0 THEN 'not_sold'
                ELSE 'null'
            END as sold_status,
            COUNT(*) as count
        FROM INVENTORY
        GROUP BY sold_status
    ");
    $soldBreakdown = [];
    while ($row = $soldResult->fetch_assoc()) {
        $soldBreakdown[$row['sold_status']] = (int)$row['count'];
    }
    
    // Get sample items that should show
    $sampleResult = $conn->query("
        SELECT 
            i.product_id,
            i.title,
            i.sold,
            i.item_status,
            i.seller_id,
            ua.email as seller_email,
            i.date_listed
        FROM INVENTORY i
        LEFT JOIN user_accounts ua ON i.seller_id = ua.user_id
        WHERE (i.sold = 0 OR i.sold IS NULL)
          AND (i.item_status = 'Active' OR i.item_status IS NULL OR i.item_status = '')
        ORDER BY i.date_listed DESC, i.product_id DESC
        LIMIT 10
    ");
    $sampleItems = [];
    while ($row = $sampleResult->fetch_assoc()) {
        $sampleItems[] = [
            'product_id' => (int)$row['product_id'],
            'title' => $row['title'],
            'sold' => $row['sold'],
            'item_status' => $row['item_status'] ?? 'NULL',
            'seller_id' => $row['seller_id'],
            'seller_email' => $row['seller_email'] ?? 'NO SELLER',
            'date_listed' => $row['date_listed']
        ];
    }
    
    // Get items that are NOT showing (to diagnose why)
    $notShowingResult = $conn->query("
        SELECT 
            i.product_id,
            i.title,
            i.sold,
            i.item_status,
            i.seller_id,
            CASE 
                WHEN i.sold = 1 THEN 'EXCLUDED: sold = 1'
                WHEN i.item_status = 'Sold' THEN 'EXCLUDED: item_status = Sold'
                WHEN i.item_status = 'Pending' THEN 'EXCLUDED: item_status = Pending'
                WHEN i.item_status = 'Draft' THEN 'EXCLUDED: item_status = Draft'
                ELSE 'OTHER'
            END as reason
        FROM INVENTORY i
        WHERE NOT (
            (i.sold = 0 OR i.sold IS NULL)
            AND (i.item_status = 'Active' OR i.item_status IS NULL OR i.item_status = '')
        )
        ORDER BY i.date_listed DESC, i.product_id DESC
        LIMIT 10
    ");
    $notShowingItems = [];
    while ($row = $notShowingResult->fetch_assoc()) {
        $notShowingItems[] = [
            'product_id' => (int)$row['product_id'],
            'title' => $row['title'],
            'sold' => $row['sold'],
            'item_status' => $row['item_status'] ?? 'NULL',
            'reason' => $row['reason']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'summary' => [
            'total_items' => $totalItems,
            'items_that_should_show' => $activeItems,
            'items_not_showing' => $totalItems - $activeItems
        ],
        'status_breakdown' => $statusBreakdown,
        'sold_breakdown' => $soldBreakdown,
        'sample_items_that_should_show' => $sampleItems,
        'sample_items_not_showing' => $notShowingItems
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => escapeHtml($e->getMessage())
    ]);
}

