START TRANSACTION;
-- Seed data to support chat feature QA scenario (Task 276)

-- First, get the user IDs if they exist (for cleanup)
SELECT user_id INTO @existing_buyer_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesblue@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @existing_seller_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesgreen@buffalo.edu'
LIMIT 1;

-- Delete related records in dependency order before deleting user accounts
-- Only delete if user IDs exist (handle NULL case)
-- 1. Delete messages where these users are sender or receiver
DELETE FROM messages
WHERE (@existing_buyer_id IS NOT NULL AND (sender_id = @existing_buyer_id OR receiver_id = @existing_buyer_id))
   OR (@existing_seller_id IS NOT NULL AND (sender_id = @existing_seller_id OR receiver_id = @existing_seller_id));

-- 2. Delete conversations where these users participate (this cascades to conversation_participants)
DELETE FROM conversations
WHERE (@existing_buyer_id IS NOT NULL AND (user1_id = @existing_buyer_id OR user2_id = @existing_buyer_id))
   OR (@existing_seller_id IS NOT NULL AND (user1_id = @existing_seller_id OR user2_id = @existing_seller_id));

-- 3. Delete conversation_participants (in case cascade didn't work)
DELETE FROM conversation_participants
WHERE (@existing_buyer_id IS NOT NULL AND user_id = @existing_buyer_id)
   OR (@existing_seller_id IS NOT NULL AND user_id = @existing_seller_id);

-- 4. Delete any scheduled purchase requests
DELETE FROM scheduled_purchase_requests
WHERE (@existing_buyer_id IS NOT NULL AND (buyer_user_id = @existing_buyer_id OR seller_user_id = @existing_buyer_id))
   OR (@existing_seller_id IS NOT NULL AND (buyer_user_id = @existing_seller_id OR seller_user_id = @existing_seller_id));

-- 5. Delete purchased items
DELETE FROM purchased_items
WHERE (@existing_buyer_id IS NOT NULL AND (buyer_user_id = @existing_buyer_id OR seller_user_id = @existing_buyer_id))
   OR (@existing_seller_id IS NOT NULL AND (buyer_user_id = @existing_seller_id OR seller_user_id = @existing_seller_id));

-- 6. Delete inventory items owned by seller
DELETE FROM INVENTORY
WHERE @existing_seller_id IS NOT NULL AND seller_id = @existing_seller_id;

-- Now safe to delete user accounts
DELETE FROM user_accounts
WHERE email IN (
  'testuserchatfeaturesblue@buffalo.edu',
  'testuserchatfeaturesgreen@buffalo.edu'
);

-- Buyer account (Po Dameron) – standard user
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
  'Po',
  'Dameron',
  5,
  2027,
  'testuserchatfeaturesblue@buffalo.edu',
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

-- Seller account (Kylo Ren) – able to create listings
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
  'Kylo',
  'Ren',
  5,
  2027,
  'testuserchatfeaturesgreen@buffalo.edu',
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

-- Capture user ids for linking records
SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesblue@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesgreen@buffalo.edu'
LIMIT 1;

-- Reset existing listings tied to this scenario
DELETE FROM INVENTORY
WHERE title = 'Custom Gamecube Controller';

-- Insert the chat feature showcase listing
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
  'Custom Gamecube Controller',
  JSON_ARRAY('Gaming', 'Electronics'),
  'North Campus',
  'Like New',
  'This is a custom gamceube controller, created by the desginer Control-In-Color. This is a cartoon and stylized design of the "Great Wave Off Kanagawa" by Hokusai. It has custom front and outer shells. The back shell has the tag "SAMMY" on it. There is also come blue tape around the cord for more style.There does not exist any mods for in-game control. The stick certainly is looser than a new controller, but its not terrible. You for sure want to play Melee with UCF and a good monitor, but this controller is certainly not going to hold you back or anthing like that.This is most definitely best used for competitive Super Smash Bros. across various installments.',
  JSON_ARRAY('/images/custom-gamecube-controller.jpg'),
  80.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;


