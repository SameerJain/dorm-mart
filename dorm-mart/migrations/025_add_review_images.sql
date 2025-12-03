-- 025_add_review_images.sql
-- Adds image upload support to product reviews (up to 3 images per review)
-- Images are stored in /media/review-images/ directory

-- Check and add columns only if they don't exist
SET @exist_image1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_reviews' AND COLUMN_NAME = 'image1_url');
SET @exist_image2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_reviews' AND COLUMN_NAME = 'image2_url');
SET @exist_image3 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_reviews' AND COLUMN_NAME = 'image3_url');

SET @sql_image1 = IF(@exist_image1 = 0, 'ALTER TABLE product_reviews ADD COLUMN image1_url TEXT NULL AFTER review_text;', 'SELECT "image1_url already exists";');
SET @sql_image2 = IF(@exist_image2 = 0, 'ALTER TABLE product_reviews ADD COLUMN image2_url TEXT NULL AFTER image1_url;', 'SELECT "image2_url already exists";');
SET @sql_image3 = IF(@exist_image3 = 0, 'ALTER TABLE product_reviews ADD COLUMN image3_url TEXT NULL AFTER image2_url;', 'SELECT "image3_url already exists";');

PREPARE stmt1 FROM @sql_image1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

PREPARE stmt2 FROM @sql_image2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

PREPARE stmt3 FROM @sql_image3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

