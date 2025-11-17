START TRANSACTION;
-- 012_iphone_case_review_test_data.sql
-- Seed data for buyer review submission tests
-- Creates a completed purchase: iPhone Case sold by testuserschedulered@buffalo.edu to testuser@buffalo.edu
-- Note: Review should be manually submitted by tester (testuser@buffalo.edu) after this data is seeded

-- Get user IDs (users must exist from previous migrations/data files)
-- If users don't exist, these will be NULL and subsequent operations will fail
SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuser@buffalo.edu'
LIMIT 1;

SELECT user_id, first_name, last_name INTO @seller_id, @seller_first_name, @seller_last_name
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete any existing iPhone Case item and related records (idempotent cleanup)
-- First get the product_id if it exists
SET @existing_product_id = (SELECT product_id FROM INVENTORY WHERE title = 'iPhone Case' AND seller_id = @seller_id LIMIT 1);

DELETE FROM confirm_purchase_requests
WHERE inventory_product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'iPhone Case');

DELETE FROM scheduled_purchase_requests
WHERE inventory_product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'iPhone Case');

DELETE FROM product_reviews
WHERE product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'iPhone Case');

DELETE FROM purchased_items
WHERE title = 'iPhone Case';

-- Remove from purchase_history JSON array if exists
UPDATE purchase_history
SET items = JSON_REMOVE(
  items,
  JSON_UNQUOTE(JSON_SEARCH(items, 'one', CAST(@existing_product_id AS CHAR)))
)
WHERE user_id = @buyer_id 
  AND @existing_product_id IS NOT NULL
  AND JSON_SEARCH(items, 'one', CAST(@existing_product_id AS CHAR)) IS NOT NULL;

DELETE FROM INVENTORY
WHERE title = 'iPhone Case' AND seller_id = @seller_id;

-- Create iPhone Case item in INVENTORY
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
  sold,
  sold_to
) VALUES (
  'iPhone Case',
  JSON_ARRAY('Electronics'),
  'North Campus',
  'Like New',
  'Protective iPhone case with excellent grip and drop protection. Barely used, in excellent condition.',
  JSON_ARRAY('/images/iphone-case-product-image.jpg'),
  15.00,
  'Sold',
  0,
  0,
  CURDATE(),
  @seller_id,
  1,
  @buyer_id
);

-- Get the product_id of the newly created item
SELECT product_id INTO @product_id
FROM INVENTORY
WHERE title = 'iPhone Case' AND seller_id = @seller_id
LIMIT 1;

-- Get first names for conversation
SELECT first_name INTO @buyer_first_name
FROM user_accounts
WHERE user_id = @buyer_id
LIMIT 1;

SELECT first_name INTO @seller_first_name_for_conv
FROM user_accounts
WHERE user_id = @seller_id
LIMIT 1;

-- Get or create conversation between buyer and seller (required for scheduled/confirm purchases)
INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, user1_deleted, user2_deleted)
VALUES (
  LEAST(@buyer_id, @seller_id),
  GREATEST(@buyer_id, @seller_id),
  IF(@buyer_id < @seller_id, @buyer_first_name, @seller_first_name_for_conv),
  IF(@buyer_id < @seller_id, @seller_first_name_for_conv, @buyer_first_name),
  FALSE,
  FALSE
)
ON DUPLICATE KEY UPDATE
  user1_deleted = FALSE,
  user2_deleted = FALSE;

-- Get the conversation_id
SELECT conv_id INTO @conversation_id
FROM conversations
WHERE user1_id = LEAST(@buyer_id, @seller_id)
  AND user2_id = GREATEST(@buyer_id, @seller_id)
LIMIT 1;

-- Create scheduled_purchase_requests record (required for receipt)
-- Delete any existing one first to ensure clean state
DELETE FROM scheduled_purchase_requests
WHERE inventory_product_id = @product_id;

-- Generate a unique verification code by using product_id + timestamp to ensure uniqueness
INSERT INTO scheduled_purchase_requests (
  inventory_product_id,
  seller_user_id,
  buyer_user_id,
  conversation_id,
  meet_location,
  meeting_at,
  verification_code,
  description,
  status,
  buyer_response_at
) VALUES (
  @product_id,
  @seller_id,
  @buyer_id,
  @conversation_id,
  'North Campus',
  DATE_SUB(NOW(), INTERVAL 3 DAY),
  LPAD((@product_id * 100 + UNIX_TIMESTAMP() % 10000) % 10000, 4, '0'),
  NULL,
  'accepted',
  DATE_SUB(NOW(), INTERVAL 3 DAY)
);

-- Get the scheduled_request_id
SELECT request_id INTO @scheduled_request_id
FROM scheduled_purchase_requests
WHERE inventory_product_id = @product_id
  AND seller_user_id = @seller_id
  AND buyer_user_id = @buyer_id
LIMIT 1;

-- Create confirm_purchase_requests record (required for receipt)
-- Delete any existing one first to ensure clean state
DELETE FROM confirm_purchase_requests
WHERE inventory_product_id = @product_id;

INSERT INTO confirm_purchase_requests (
  scheduled_request_id,
  inventory_product_id,
  seller_user_id,
  buyer_user_id,
  conversation_id,
  is_successful,
  final_price,
  seller_notes,
  failure_reason,
  failure_reason_notes,
  status,
  expires_at,
  buyer_response_at,
  payload_snapshot
) VALUES (
  @scheduled_request_id,
  @product_id,
  @seller_id,
  @buyer_id,
  @conversation_id,
  TRUE,
  15.00,
  NULL,
  NULL,
  NULL,
  'buyer_accepted',
  DATE_ADD(NOW(), INTERVAL 1 DAY),
  DATE_SUB(NOW(), INTERVAL 3 DAY),
  JSON_OBJECT(
    'meeting_at', DATE_SUB(NOW(), INTERVAL 3 DAY),
    'meet_location', 'North Campus',
    'negotiated_price', 15.00,
    'is_trade', FALSE,
    'trade_item_description', NULL
  )
);

-- Create purchase record in purchased_items table
-- Note: item_id in purchased_items should match product_id from INVENTORY
-- This allows reviews to reference the correct product
DELETE FROM purchased_items 
WHERE item_id = @product_id;

INSERT INTO purchased_items (
  item_id,
  title,
  sold_by,
  transacted_at,
  buyer_user_id,
  seller_user_id,
  image_url
) VALUES (
  @product_id,
  'iPhone Case',
  CONCAT(@seller_first_name, ' ', @seller_last_name),
  DATE_SUB(NOW(), INTERVAL 3 DAY),
  @buyer_id,
  @seller_id,
  '/images/iphone-case-product-image.jpg'
);

-- Update purchase_history table for buyer
-- Insert or update the purchase_history record with the product_id in the JSON array
INSERT INTO purchase_history (user_id, items)
VALUES (@buyer_id, JSON_ARRAY(@product_id))
ON DUPLICATE KEY UPDATE
  items = JSON_ARRAY_APPEND(
    CASE 
      WHEN JSON_SEARCH(items, 'one', CAST(@product_id AS CHAR)) IS NULL 
      THEN items 
      ELSE JSON_REMOVE(items, JSON_UNQUOTE(JSON_SEARCH(items, 'one', CAST(@product_id AS CHAR))))
    END,
    '$',
    @product_id
  ),
  updated_at = NOW();

-- Note: Review should be manually submitted by tester (testuser@buffalo.edu)
-- after this data is seeded. The purchase record above allows the buyer to submit a review.
-- Expected review data:
--   Seller Rating: 4.5
--   Product Rating: 4.5
--   Review Text: "Great iPhone case! Fits perfectly, feels sturdy, and has a nice grip that prevents slipping. The buttons are responsive, it protects well from drops, and the design is sleek without adding bulk. Definitely worth the purchase."
--   Image: iphone-case-review-image.jpg (uploaded during test)

COMMIT;

