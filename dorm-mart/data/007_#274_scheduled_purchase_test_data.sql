START TRANSACTION;
-- 007_#274_scheduled_purchase_test_data.sql
-- Seed data for scheduled purchase feature testing
-- Creates test users: Luke Skywalker (seller) and Han Solo (buyer)
-- Creates test items: Scrub Daddy, Air Fryer (price negotiable), Pim Plushie (accepts trades)
-- Creates conversations between users for each item

-- First, get the user IDs if they exist (for cleanup)
SELECT user_id INTO @existing_seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @existing_buyer_id
FROM user_accounts
WHERE email = 'testuserscheduleyellow@buffalo.edu'
LIMIT 1;

-- Delete related records in dependency order before deleting user accounts
-- Must delete in order: messages -> scheduled_purchases -> conversations -> users
-- Handle NULL user IDs gracefully - only delete if users exist

-- 1. Delete messages where these users are sender or receiver (must be first due to FK constraints)
DELETE FROM messages
WHERE (@existing_seller_id IS NOT NULL AND (sender_id = @existing_seller_id OR receiver_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (sender_id = @existing_buyer_id OR receiver_id = @existing_buyer_id));

-- 2. Delete scheduled purchase requests
DELETE FROM scheduled_purchase_requests
WHERE (@existing_seller_id IS NOT NULL AND (buyer_user_id = @existing_seller_id OR seller_user_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (buyer_user_id = @existing_buyer_id OR seller_user_id = @existing_buyer_id));

-- Note: Conversations are NOT deleted here - they should be created naturally via "Message Seller" button in UI
-- 3. Delete conversations where these users participate (this cascades to conversation_participants)
DELETE FROM conversations
WHERE (@existing_seller_id IS NOT NULL AND (user1_id = @existing_seller_id OR user2_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (user1_id = @existing_buyer_id OR user2_id = @existing_buyer_id));

-- 4. Delete conversation_participants (in case cascade didn't work)
DELETE FROM conversation_participants
WHERE (@existing_seller_id IS NOT NULL AND user_id = @existing_seller_id)
   OR (@existing_buyer_id IS NOT NULL AND user_id = @existing_buyer_id);

-- 5. Delete purchased items
DELETE FROM purchased_items
WHERE (@existing_seller_id IS NOT NULL AND (buyer_user_id = @existing_seller_id OR seller_user_id = @existing_seller_id))
   OR (@existing_buyer_id IS NOT NULL AND (buyer_user_id = @existing_buyer_id OR seller_user_id = @existing_buyer_id));

-- 6. Delete inventory items owned by seller
DELETE FROM INVENTORY
WHERE @existing_seller_id IS NOT NULL AND seller_id = @existing_seller_id;

-- Now safe to delete user accounts
DELETE FROM user_accounts
WHERE email IN (
  'testuserschedulered@buffalo.edu',
  'testuserscheduleyellow@buffalo.edu'
);

-- Seller account (Luke Skywalker) – able to create listings
INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  join_date,
  seller,
  theme,
  reset_token_expires,
  last_reset_request,
  received_intro_promo_email,
  reveal_contact_info,
  interested_category_1,
  interested_category_2,
  interested_category_3
) VALUES (
  'Luke',
  'Skywalker',
  5,
  2027,
  'testuserschedulered@buffalo.edu',
  0,
  '$2y$10$kXWN5BJO0ZG8Rynf7FEzPekQ5fiwXMiFttJpDjvrnncuym0DHHxRq', -- password: 1234!
  NULL,
  CURDATE(),
  1,
  0,
  NULL,
  NULL,
  0,
  0,
  NULL,
  NULL,
  NULL
);

-- Buyer account (Han Solo) – standard user
INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  join_date,
  seller,
  theme,
  reset_token_expires,
  last_reset_request,
  received_intro_promo_email,
  reveal_contact_info,
  interested_category_1,
  interested_category_2,
  interested_category_3
) VALUES (
  'Han',
  'Solo',
  5,
  2027,
  'testuserscheduleyellow@buffalo.edu',
  0,
  '$2y$10$kXWN5BJO0ZG8Rynf7FEzPekQ5fiwXMiFttJpDjvrnncuym0DHHxRq', -- password: 1234!
  NULL,
  CURDATE(),
  0,
  0,
  NULL,
  NULL,
  0,
  0,
  NULL,
  NULL,
  NULL
);

-- Capture user ids for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuserscheduleyellow@buffalo.edu'
LIMIT 1;

-- Delete existing listings tied to this scenario (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Scrub Daddy', 'Air Fryer', 'Pim Plushie');

-- Insert Scrub Daddy listing
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
  'Scrub Daddy',
  JSON_ARRAY('Kitchen', 'Utility'),
  'North Campus',
  'Like New',
  'A fun and effective cleaning sponge that changes texture based on water temperature. Perfect for scrubbing dishes, countertops, and more. Great condition, barely used.',
  JSON_ARRAY('/images/scrub-daddy.jpg'),
  10.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Air Fryer listing (price negotiable)
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
  'Air Fryer',
  JSON_ARRAY('Kitchen', 'Utility'),
  'North Campus',
  'Good',
  'Compact air fryer perfect for dorm cooking. Makes crispy fries, chicken, and more with less oil. Works great, some minor wear on the exterior but fully functional.',
  JSON_ARRAY('/images/air-fryer.jpg'),
  50.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Pim Plushie listing (accepts trades, price negotiable)
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
  'Pim Plushie',
  JSON_ARRAY('Decor', 'Games'),
  'North Campus',
  'Like New',
  'Adorable Pim plushie from Smiling Friends. Soft, cuddly, and in excellent condition. Perfect for decoration or as a gift.',
  JSON_ARRAY('/images/pim-plushie.jpg'),
  20.00,
  'Active',
  1,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Note: Conversations are NOT created here - they should be created naturally via "Message Seller" button in UI
-- The test flow requires users to click "Message Seller" which will create conversations through the API

COMMIT;

