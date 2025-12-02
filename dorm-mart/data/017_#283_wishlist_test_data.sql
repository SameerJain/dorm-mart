START TRANSACTION;
-- 017_#283_wishlist_test_data.sql
-- Seed data for wishlist feature testing
-- Adds Britta Filter Box and TECKNET Red Mouse product listings for testuserschedulered@buffalo.edu (Luke Skywalker)
-- These items are used to test the Wishlist Frontend and Backend features

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Britta Filter Box', 'TECKNET Red Mouse');

-- Insert Britta Filter Box listing
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
  'Britta Filter Box',
  JSON_ARRAY('Dorm Essentials', 'Kitchen'),
  'North Campus',
  'Like New',
  'This Brita filter box provides a convenient, reliable way to keep your home stocked with fresh, great-tasting water. Each box contains long-lasting replacement filters designed to reduce chlorine, odors, and common impurities found in tap water, delivering cleaner, crisper hydration with every pour. The clearly labeled packaging makes it easy to know when it''s time to restock, while the protective, compact design keeps the filters organized and ready for use. Compatible with a wide range of Brita pitchers and dispensers, these filters install quickly with a simple snap-in fit, making maintenance effortless. Ideal for households, offices, dorms, or anyone looking to cut down on plastic waste, this Brita filter box ensures you always have a fresh supply of filtration power on hand. It''s a smart, sustainable way to stay prepared and enjoy better water every day.',
  JSON_ARRAY('/images/britta-filter-product-image.jpg'),
  25.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert TECKNET Red Mouse listing
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
  'TECKNET Red Mouse',
  JSON_ARRAY('Electronics', 'Office'),
  'North Campus',
  'Like New',
  'This TECKNET red mouse combines bold style with reliable, high-performance functionality, making it a standout addition to any workspace or gaming setup. Featuring TECKNET''s precision optical tracking, it delivers smooth, accurate cursor control on a wide range of surfaces, perfect for work, browsing, or casual gaming. Its ergonomic, contoured shape fits comfortably in your hand, reducing strain during long sessions, while the responsive buttons and easy-scroll wheel ensure a quick, effortless user experience. The vibrant red finish adds a pop of color that sets it apart from standard accessories, and the lightweight, durable build makes it ideal for travel or daily use. With plug-and-play setup and broad device compatibility, this TECKNET mouse offers dependable performance, eye-catching style, and everyday comfort in one sleek package.',
  JSON_ARRAY('/images/teknet-mouse-product-image.webp'),
  15.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






