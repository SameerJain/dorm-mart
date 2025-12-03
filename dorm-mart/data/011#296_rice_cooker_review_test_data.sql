START TRANSACTION;
-- 011_rice_cooker_review_test_data.sql
-- Seed data for seller review viewing tests
-- Creates a completed purchase: Rice Cooker sold by testuserschedulered@buffalo.edu to testuserscheduleyellow@buffalo.edu (Han Solo)
-- Includes a pre-seeded review with image
-- Simulates organic flow: Message Seller -> Scheduled Purchase -> Confirm Purchase -> Review

-- Get user IDs (users must exist from previous migrations/data files)
-- If users don't exist, these will be NULL and subsequent operations will fail
SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuserscheduleyellow@buffalo.edu'
LIMIT 1;

SELECT user_id, first_name, last_name INTO @seller_id, @seller_first_name, @seller_last_name
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete any existing Rice Cooker item and related records (idempotent cleanup)
-- First get the product_id if it exists
SET @existing_product_id = (SELECT product_id FROM INVENTORY WHERE title = 'Rice Cooker' AND seller_id = @seller_id LIMIT 1);

-- Delete messages first (due to FK constraints)
DELETE FROM messages
WHERE conv_id IN (
  SELECT conv_id FROM conversations 
  WHERE product_id = @existing_product_id 
  AND @existing_product_id IS NOT NULL
);

-- Delete conversation participants
DELETE FROM conversation_participants
WHERE conv_id IN (
  SELECT conv_id FROM conversations 
  WHERE product_id = @existing_product_id 
  AND @existing_product_id IS NOT NULL
);

-- Delete conversations
DELETE FROM conversations
WHERE product_id = @existing_product_id 
AND @existing_product_id IS NOT NULL;

DELETE FROM confirm_purchase_requests
WHERE inventory_product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'Rice Cooker');

DELETE FROM scheduled_purchase_requests
WHERE inventory_product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'Rice Cooker');

DELETE FROM product_reviews
WHERE product_id IN (SELECT product_id FROM INVENTORY WHERE title = 'Rice Cooker');

DELETE FROM purchased_items
WHERE title = 'Rice Cooker';

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
WHERE title = 'Rice Cooker' AND seller_id = @seller_id;

-- Create Rice Cooker item in INVENTORY
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
  'Rice Cooker',
  JSON_ARRAY('Kitchen'),
  'North Campus',
  'Like New',
  'Compact rice cooker perfect for dorm life. Makes perfect rice every time. Barely used, in excellent condition.',
  JSON_ARRAY('/images/rice-cooker-product-image.jpg'),
  25.00,
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
WHERE title = 'Rice Cooker' AND seller_id = @seller_id
LIMIT 1;

-- Get names for conversation and messages
SELECT first_name, last_name INTO @buyer_first_name, @buyer_last_name
FROM user_accounts
WHERE user_id = @buyer_id
LIMIT 1;

SELECT first_name, last_name INTO @seller_first_name_for_conv, @seller_last_name_for_conv
FROM user_accounts
WHERE user_id = @seller_id
LIMIT 1;

-- Get full names for display
SET @buyer_full_name = CONCAT(@buyer_first_name, ' ', @buyer_last_name);
SET @seller_full_name = CONCAT(@seller_first_name_for_conv, ' ', @seller_last_name_for_conv);
SET @buyer_display_name = IF(@buyer_full_name IS NULL OR TRIM(@buyer_full_name) = '', @buyer_first_name, @buyer_full_name);
SET @seller_display_name = IF(@seller_full_name IS NULL OR TRIM(@seller_full_name) = '', @seller_first_name_for_conv, @seller_full_name);

-- Create conversation between buyer and seller with product_id (simulates "Message Seller" click)
-- This is the organic flow: buyer clicks "Message Seller" which creates conversation with product_id
INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id, user1_deleted, user2_deleted)
VALUES (
  LEAST(@buyer_id, @seller_id),
  GREATEST(@buyer_id, @seller_id),
  IF(@buyer_id < @seller_id, @buyer_display_name, @seller_display_name),
  IF(@buyer_id < @seller_id, @seller_display_name, @buyer_display_name),
  @product_id,
  FALSE,
  FALSE
)
ON DUPLICATE KEY UPDATE
  user1_deleted = FALSE,
  user2_deleted = FALSE,
  product_id = @product_id;

-- Get the conversation_id
SELECT conv_id INTO @conversation_id
FROM conversations
WHERE user1_id = LEAST(@buyer_id, @seller_id)
  AND user2_id = GREATEST(@buyer_id, @seller_id)
  AND product_id = @product_id
LIMIT 1;

-- Create conversation participants (required for chat functionality)
INSERT INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
VALUES (@conversation_id, @buyer_id, NULL, 0)
ON DUPLICATE KEY UPDATE first_unread_msg_id = first_unread_msg_id;

INSERT INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
VALUES (@conversation_id, @seller_id, NULL, 0)
ON DUPLICATE KEY UPDATE first_unread_msg_id = first_unread_msg_id;

-- Create the initial auto-message that appears when buyer clicks "Message Seller"
-- This simulates the automatic message: "{buyerName} would like to message you about {productTitle}"
INSERT INTO messages (
  conv_id,
  sender_id,
  receiver_id,
  sender_fname,
  receiver_fname,
  content,
  metadata
)
VALUES (
  @conversation_id,
  @buyer_id,
  @seller_id,
  IFNULL(@buyer_display_name, CONCAT('User ', @buyer_id)),
  IFNULL(@seller_display_name, CONCAT('User ', @seller_id)),
  CONCAT(@buyer_display_name, ' would like to message you about Rice Cooker'),
  JSON_OBJECT(
    'type', 'listing_intro',
    'product', JSON_OBJECT(
      'product_id', @product_id,
      'title', 'Rice Cooker',
      'image_url', '/images/rice-cooker-product-image.jpg'
    ),
    'buyer_name', @buyer_display_name
  )
);

-- Get the auto-message ID for updating unread count
SELECT message_id INTO @auto_message_id
FROM messages
WHERE conv_id = @conversation_id
  AND sender_id = @buyer_id
  AND receiver_id = @seller_id
  AND JSON_EXTRACT(metadata, '$.type') = 'listing_intro'
LIMIT 1;

-- Update seller's unread count (buyer sent the initial message)
UPDATE conversation_participants
SET unread_count = unread_count + 1,
    first_unread_msg_id = CASE
        WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN @auto_message_id
        ELSE first_unread_msg_id
    END
WHERE conv_id = @conversation_id 
  AND user_id = @seller_id
  AND @auto_message_id IS NOT NULL;

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
  DATE_SUB(NOW(), INTERVAL 2 DAY),
  LPAD((@product_id * 100 + UNIX_TIMESTAMP() % 10000) % 10000, 4, '0'),
  NULL,
  'accepted',
  DATE_SUB(NOW(), INTERVAL 2 DAY)
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
  25.00,
  NULL,
  NULL,
  NULL,
  'buyer_accepted',
  DATE_ADD(NOW(), INTERVAL 1 DAY),
  DATE_SUB(NOW(), INTERVAL 2 DAY),
  JSON_OBJECT(
    'meeting_at', DATE_SUB(NOW(), INTERVAL 2 DAY),
    'meet_location', 'North Campus',
    'negotiated_price', 25.00,
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
  'Rice Cooker',
  CONCAT(@seller_first_name, ' ', @seller_last_name),
  DATE_SUB(NOW(), INTERVAL 2 DAY),
  @buyer_id,
  @seller_id,
  '/images/rice-cooker-product-image.jpg'
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

-- Create a pre-seeded product review for the Rice Cooker
-- Buyer (testuserscheduleyellow@buffalo.edu - Han Solo) reviews seller (testuserschedulered@buffalo.edu - Luke Skywalker)
-- Note: Review image path should match what the API returns (test shows specific format but generic path should work)
INSERT INTO product_reviews (
  product_id,
  buyer_user_id,
  seller_user_id,
  rating,
  product_rating,
  review_text,
  image1_url,
  image2_url,
  image3_url
) VALUES (
  @product_id,
  @buyer_id,
  @seller_id,
  5,
  5,
  'This rice cooker is super useful! Take a look at what I have made.',
  '/media/review-images/rice-cooker-review-image.jpg',
  NULL,
  NULL
);

COMMIT;

