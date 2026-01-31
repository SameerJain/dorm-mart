-- Add image_url column to messages table (idempotent)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'messages' 
     AND COLUMN_NAME = 'image_url') = 0,
    'ALTER TABLE messages ADD COLUMN image_url VARCHAR(255) NULL AFTER content',
    'SELECT "Column image_url already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
