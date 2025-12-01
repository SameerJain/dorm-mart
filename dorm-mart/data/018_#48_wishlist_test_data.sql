START TRANSACTION;
-- 018_#48_wishlist_test_data.sql
-- Seed data for wishlist feature testing
-- Adds Calculus: Early Transcendentals textbook listing for testuserschedulered@buffalo.edu (Luke Skywalker)
-- This item is used to test the wishlist add/remove functionality

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listing if it exists (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title = 'Calculus: Early Transcendentals';

-- Insert Calculus: Early Transcendentals listing
INSERT INTO INVENTORY (
  title,
  categories,
  item_location,
  item_condition,
  description,
  photos,
  listing_price,
  item_status,
  trades,
  price_nego,
  date_listed,
  seller_id,
  sold
) VALUES (
  'Calculus: Early Transcendentals',
  JSON_ARRAY('Books', 'School'),
  'North Campus',
  'Like New',
  'Calculus: Early Transcendentals is a comprehensive, widely respected textbook designed to build a strong foundation in differential and integral calculus. Clear explanations, rigorous examples, and thoughtfully structured chapters guide students from fundamental concepts to advanced problem-solving. With its emphasis on early introduction of transcendental functions, the book helps learners develop intuition and confidence as topics progress. Detailed diagrams, practice problems, and real-world applications make it ideal for high school, college, or self-study. Durable, reliable, and academically trusted, this textbook is an essential resource for mastering calculus.',
  JSON_ARRAY('/images/calculus-early-transcdentals-product-image.jpg'),
  80.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;





