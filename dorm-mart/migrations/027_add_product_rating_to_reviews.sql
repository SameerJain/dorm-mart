-- 027_add_product_rating_to_reviews.sql
-- Adds product_rating column to product_reviews table to store separate product ratings
-- The existing 'rating' column remains for seller rating

ALTER TABLE product_reviews 
ADD COLUMN product_rating DECIMAL(2,1) NULL DEFAULT NULL AFTER rating;

