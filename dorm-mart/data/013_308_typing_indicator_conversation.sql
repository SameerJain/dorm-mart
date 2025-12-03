START TRANSACTION;
-- 013_308_typing_indicator_conversation.sql
-- Seed data for typing indicator feature testing
-- Creates product listing: Anker Portable Charger by testuserschedulered@buffalo.edu
-- Creates conversation between testuser@buffalo.edu and testuserschedulered@buffalo.edu for this item
-- This simulates testuser@buffalo.edu clicking "Message Seller" for the Anker Portable Charger

-- Get user IDs for seller and buyer
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @buyer_id
FROM user_accounts
WHERE email = 'testuser@buffalo.edu'
LIMIT 1;

-- Verify both users exist
SET @seller_exists = (@seller_id IS NOT NULL);
SET @buyer_exists = (@buyer_id IS NOT NULL);

-- Delete existing conversation for this product if it exists (must be before deleting product due to FK)
DELETE c FROM conversations c
INNER JOIN INVENTORY i ON c.product_id = i.product_id
WHERE i.title = 'Anker Portable Charger' AND i.seller_id = @seller_id;

-- Delete existing product listing if it exists (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title = 'Anker Portable Charger' AND (@seller_id IS NULL OR seller_id = @seller_id);

-- Only proceed if both users exist
SET @should_proceed = (@seller_exists AND @buyer_exists);

-- Insert Anker Portable Charger listing (only if users exist)
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
) 
SELECT 
  'Anker Portable Charger',
  JSON_ARRAY('Electronics', 'Utility'),
  'North Campus',
  'Like New',
  'This Anker portable charger provides dependable, high-speed power wherever you go, making it an essential companion for travel, work, and everyday use. Featuring Anker''s advanced PowerIQ technology, it intelligently identifies your device to deliver optimized charging, ensuring fast and efficient performance for smartphones, tablets, earbuds, and other USB-powered gear. Its high-capacity battery offers multiple charges for most phones, giving you peace of mind during long days, commutes, or emergencies. Designed with a compact, lightweight body, it slips easily into pockets, backpacks, or purses without adding bulk, while the durable exterior protects it from daily wear. With user-friendly operation, reliable safety features, and the trusted quality Anker is known for, this portable charger keeps you powered up anytime you need it.',
  JSON_ARRAY('/images/anker-charger-product-image.jpg'),
  35.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
WHERE @should_proceed = 1;

-- Get the product_id for the newly created item
SELECT product_id INTO @product_id
FROM INVENTORY
WHERE title = 'Anker Portable Charger' AND seller_id = @seller_id
LIMIT 1;

-- Get first names for conversation
SELECT first_name INTO @seller_first_name
FROM user_accounts
WHERE user_id = @seller_id
LIMIT 1;

SELECT first_name INTO @buyer_first_name
FROM user_accounts
WHERE user_id = @buyer_id
LIMIT 1;

-- Create conversation between buyer and seller for this product
-- This simulates testuser@buffalo.edu clicking "Message Seller" button
INSERT INTO conversations (
  user1_id,
  user2_id,
  user1_fname,
  user2_fname,
  product_id,
  user1_deleted,
  user2_deleted
)
SELECT 
  LEAST(@buyer_id, @seller_id),
  GREATEST(@buyer_id, @seller_id),
  IF(@buyer_id < @seller_id, @buyer_first_name, @seller_first_name),
  IF(@buyer_id < @seller_id, @seller_first_name, @buyer_first_name),
  @product_id,
  FALSE,
  FALSE
WHERE @should_proceed = 1 AND @product_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  user1_deleted = FALSE,
  user2_deleted = FALSE,
  product_id = @product_id;

-- Get conversation_id for reference
SELECT conv_id INTO @conversation_id
FROM conversations
WHERE user1_id = LEAST(@buyer_id, @seller_id)
  AND user2_id = GREATEST(@buyer_id, @seller_id)
  AND product_id = @product_id
LIMIT 1;

-- Create conversation participants (required for chat functionality)
INSERT INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
SELECT @conversation_id, @buyer_id, NULL, 0
WHERE @conversation_id IS NOT NULL
ON DUPLICATE KEY UPDATE first_unread_msg_id = first_unread_msg_id;

INSERT INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
SELECT @conversation_id, @seller_id, NULL, 0
WHERE @conversation_id IS NOT NULL
ON DUPLICATE KEY UPDATE first_unread_msg_id = first_unread_msg_id;

-- Create the initial auto-message that appears when buyer clicks "Message Seller"
-- This simulates the automatic message: "{buyerName} would like to message you about {productTitle}"
SELECT CONCAT(@buyer_first_name, ' ', (SELECT last_name FROM user_accounts WHERE user_id = @buyer_id LIMIT 1)) INTO @buyer_full_name;
SELECT CONCAT(@seller_first_name, ' ', (SELECT last_name FROM user_accounts WHERE user_id = @seller_id LIMIT 1)) INTO @seller_full_name;

-- Set buyer name, defaulting to first name if full name is empty
SET @buyer_display_name = IF(@buyer_full_name IS NULL OR TRIM(@buyer_full_name) = '', @buyer_first_name, @buyer_full_name);
SET @seller_display_name = IF(@seller_full_name IS NULL OR TRIM(@seller_full_name) = '', @seller_first_name, @seller_full_name);

-- Create the auto-message with metadata (same format as ensure_conversation.php)
INSERT INTO messages (
  conv_id,
  sender_id,
  receiver_id,
  sender_fname,
  receiver_fname,
  content,
  metadata
)
SELECT 
  @conversation_id,
  @buyer_id,
  @seller_id,
  IFNULL(@buyer_display_name, CONCAT('User ', @buyer_id)),
  IFNULL(@seller_display_name, CONCAT('User ', @seller_id)),
  CONCAT(@buyer_display_name, ' would like to message you about Anker Portable Charger'),
  JSON_OBJECT(
    'type', 'listing_intro',
    'product', JSON_OBJECT(
      'product_id', @product_id,
      'title', 'Anker Portable Charger',
      'image_url', '/images/anker-charger-product-image.jpg'
    ),
    'buyer_name', @buyer_display_name
  )
WHERE @conversation_id IS NOT NULL AND @product_id IS NOT NULL;

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

COMMIT;

