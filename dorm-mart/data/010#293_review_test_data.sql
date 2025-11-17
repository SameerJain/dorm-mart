START TRANSACTION;
-- 010_review_test_data.sql
-- Seed data for review feature testing
-- Creates a completed purchase: Marble Notebook sold by testuserschedulered@buffalo.edu to testuser@buffalo.edu

-- Get user IDs (assuming they exist from previous migrations)
SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuser@buffalo.edu'
LIMIT 1;

SELECT user_id, first_name, last_name INTO @seller_id, @seller_first_name, @seller_last_name
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete any existing Marble Notebook item and related records (idempotent cleanup)
DELETE FROM confirm_purchase_requests
WHERE inventory_product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'Marble Notebook');

DELETE FROM scheduled_purchase_requests
WHERE inventory_product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'Marble Notebook');

DELETE FROM product_reviews
WHERE product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'Marble Notebook');

DELETE FROM purchased_items
WHERE title = 'Marble Notebook' AND buyer_user_id = @buyer_id AND seller_user_id = @seller_id;

DELETE FROM INVENTORY
WHERE title = 'Marble Notebook' AND seller_id = @seller_id;

-- Create Marble Notebook item in INVENTORY
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
  'Marble Notebook',
  JSON_ARRAY('School', 'Stationary'),
  'North Campus',
  'Like New',
  'Classic marble composition notebook. Perfect for taking notes in class. Barely used, in excellent condition.',
  JSON_ARRAY('/images/marble-notebook.jpg'),
  5.00,
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
WHERE title = 'Marble Notebook' AND seller_id = @seller_id
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
  DATE_SUB(NOW(), INTERVAL 1 DAY),
  LPAD((@product_id * 100 + UNIX_TIMESTAMP() % 10000) % 10000, 4, '0'),
  NULL,
  'accepted',
  DATE_SUB(NOW(), INTERVAL 1 DAY)
);

-- Get the scheduled_request_id
SELECT request_id INTO @scheduled_request_id
FROM scheduled_purchase_requests
WHERE inventory_product_id = @product_id
  AND seller_user_id = @seller_id
  AND buyer_user_id = @buyer_id
LIMIT 1;

-- Create confirm_purchase_requests record (required for receipt) - only if it doesn't exist
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
)
SELECT 
  @scheduled_request_id,
  @product_id,
  @seller_id,
  @buyer_id,
  @conversation_id,
  TRUE,
  5.00,
  NULL,
  NULL,
  NULL,
  'buyer_accepted',
  DATE_ADD(NOW(), INTERVAL 1 DAY),
  DATE_SUB(NOW(), INTERVAL 1 DAY),
  JSON_OBJECT(
    'meeting_at', DATE_SUB(NOW(), INTERVAL 1 DAY),
    'meet_location', 'North Campus',
    'negotiated_price', 5.00,
    'is_trade', FALSE,
    'trade_item_description', NULL
  )
WHERE NOT EXISTS (
  SELECT 1 FROM confirm_purchase_requests
  WHERE inventory_product_id = @product_id
    AND seller_user_id = @seller_id
    AND buyer_user_id = @buyer_id
);

-- Create purchase record in purchased_items table
INSERT INTO purchased_items (
  title,
  sold_by,
  transacted_at,
  buyer_user_id,
  seller_user_id,
  image_url
) VALUES (
  'Marble Notebook',
  CONCAT(@seller_first_name, ' ', @seller_last_name),
  NOW(),
  @buyer_id,
  @seller_id,
  '/images/marble-notebook.jpg'
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

COMMIT;

