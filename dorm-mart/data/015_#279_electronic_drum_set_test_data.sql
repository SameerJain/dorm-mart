START TRANSACTION;
-- 015_#279_electronic_drum_set_test_data.sql
-- Seed data for scheduled purchase feature testing - Electronic Drum Set
-- Adds an electronic drum set product listing for testuserschedulered@buffalo.edu (Luke Skywalker)
-- This makes Test 1 clearer by providing a distinct product for testing scheduled purchases

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing Electronic Drum Set listing if it exists (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title = 'Electronic Drum Set';

-- Insert Electronic Drum Set listing
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
  'Electronic Drum Set',
  JSON_ARRAY('Electronics', 'Gaming'),
  'North Campus',
  'Like New',
  'This electronic drum set offers a powerful, versatile playing experience for beginners and experienced drummers alike, delivering realistic sound and responsive feel in a compact, home-friendly design. Featuring multiple mesh drum pads, sensitive cymbals, and a performance-ready drum module loaded with high-quality kits and customizable settings, it lets you practice, record, or perform with ease. The mesh heads provide natural rebound and quiet operation, making them perfect for late-night sessions, while the sturdy rack keeps everything stable during energetic play. With built-in coaching functions, metronome tools, and headphone compatibility, you can improve your skills without disturbing others. USB and audio outputs make it simple to connect to computers, amps, or recording software. Durable, adjustable, and easy to set up, this electronic drum set delivers professional features in a space-saving package ideal for any practice room or bedroom studio.',
  JSON_ARRAY('/images/electronic-drum-set-product-image.jpeg'),
  250.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;






