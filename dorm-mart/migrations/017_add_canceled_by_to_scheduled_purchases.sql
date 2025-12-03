-- 017_add_canceled_by_to_scheduled_purchases.sql
-- Adds canceled_by_user_id column to track who canceled a scheduled purchase request
-- Uses idempotent checks to allow safe re-running if column already exists

-- Add canceled_by_user_id column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND COLUMN_NAME = 'canceled_by_user_id') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD COLUMN canceled_by_user_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER status',
    'SELECT "Column canceled_by_user_id already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint if column was just created
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND CONSTRAINT_NAME = 'fk_sched_purchase_canceled_by') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD CONSTRAINT fk_sched_purchase_canceled_by FOREIGN KEY (canceled_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT "Foreign key constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for querying canceled purchases
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND INDEX_NAME = 'idx_scheduled_purchase_canceled_by') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD INDEX idx_scheduled_purchase_canceled_by (canceled_by_user_id)',
    'SELECT "Index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;



