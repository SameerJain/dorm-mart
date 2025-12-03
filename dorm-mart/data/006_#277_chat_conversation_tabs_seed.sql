-- 006_#277_chat_conversation_tabs_seed.sql
-- Seed data for testing separate chat conversations per product
-- Creates two products: Blue Water Bottle (Kylo Ren) and White and Blue Backpack (Po Dameron)

START TRANSACTION;

-- Get user IDs for the test accounts (these should already exist from 005_#276)
SELECT user_id INTO @kylo_ren_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesgreen@buffalo.edu'
LIMIT 1;

SELECT user_id INTO @po_dameron_id
FROM user_accounts
WHERE email = 'testuserchatfeaturesblue@buffalo.edu'
LIMIT 1;

-- Update Po Dameron to be a seller (needed for White and Blue Backpack listing)
UPDATE user_accounts
SET seller = 1
WHERE email = 'testuserchatfeaturesblue@buffalo.edu';

-- Delete existing products with these titles (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Blue Water Bottle', 'White and Blue Backpack');

-- Insert Blue Water Bottle (sold by Kylo Ren - testuserchatfeaturesgreen@buffalo.edu)
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
  'Blue Water Bottle',
  JSON_ARRAY('Health', 'Dorm Essentials'),
  'North Campus',
  'Like New',
  'A high-quality blue water bottle perfect for staying hydrated on campus. Great condition with no leaks or damage.',
  JSON_ARRAY('/images/blue-water-bottle.jpg'),
  15.00,
  'Active',
  0,
  1,
  CURDATE(),
  @kylo_ren_id,
  0
);

-- Insert White and Blue Backpack (sold by Po Dameron - testuserchatfeaturesblue@buffalo.edu)
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
  'White and Blue Backpack',
  JSON_ARRAY('School', 'Dorm Essentials'),
  'North Campus',
  'Good',
  'A stylish white and blue backpack with multiple compartments. Perfect for carrying books and laptop to class.',
  JSON_ARRAY('/images/white-blue-backpack.jpg'),
  25.00,
  'Active',
  0,
  1,
  CURDATE(),
  @po_dameron_id,
  0
);

COMMIT;

