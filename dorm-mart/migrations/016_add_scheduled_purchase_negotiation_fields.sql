-- 016_add_scheduled_purchase_negotiation_fields.sql
-- Adds fields to scheduled_purchase_requests table for price negotiation and trade functionality
-- Uses idempotent checks to allow safe re-running if columns already exist

-- Add negotiated_price column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND COLUMN_NAME = 'negotiated_price') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD COLUMN negotiated_price DECIMAL(10,2) NULL DEFAULT NULL AFTER description',
    'SELECT "Column negotiated_price already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_trade column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND COLUMN_NAME = 'is_trade') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD COLUMN is_trade BOOLEAN NOT NULL DEFAULT FALSE AFTER negotiated_price',
    'SELECT "Column is_trade already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add trade_item_description column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND COLUMN_NAME = 'trade_item_description') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD COLUMN trade_item_description TEXT NULL DEFAULT NULL AFTER is_trade',
    'SELECT "Column trade_item_description already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add snapshot_price_nego column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND COLUMN_NAME = 'snapshot_price_nego') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD COLUMN snapshot_price_nego BOOLEAN NOT NULL DEFAULT FALSE AFTER trade_item_description',
    'SELECT "Column snapshot_price_nego already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add snapshot_trades column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND COLUMN_NAME = 'snapshot_trades') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD COLUMN snapshot_trades BOOLEAN NOT NULL DEFAULT FALSE AFTER snapshot_price_nego',
    'SELECT "Column snapshot_trades already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add snapshot_meet_location column
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'scheduled_purchase_requests' 
     AND COLUMN_NAME = 'snapshot_meet_location') = 0,
    'ALTER TABLE scheduled_purchase_requests ADD COLUMN snapshot_meet_location VARCHAR(255) NULL DEFAULT NULL AFTER snapshot_trades',
    'SELECT "Column snapshot_meet_location already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


