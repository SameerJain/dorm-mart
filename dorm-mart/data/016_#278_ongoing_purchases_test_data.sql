START TRANSACTION;
-- 016_#278_ongoing_purchases_test_data.sql
-- Seed data for ongoing purchases page feature testing
-- Adds Gaming Chair and Christmas Ornament product listings for testuserschedulered@buffalo.edu (Luke Skywalker)
-- These items are used to test the Ongoing Purchases Page and scheduled purchase features

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Gaming Chair', 'Christmas Ornament');

-- Insert Gaming Chair listing
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
  'Gaming Chair',
  JSON_ARRAY('Gaming', 'Furniture', 'Office'),
  'North Campus',
  'Like New',
  'This gaming chair is built for comfort, support, and style, making long gaming sessions easier and more enjoyable. Designed with an ergonomic, high-back structure, it features contoured padding that supports your spine, neck, and lower back, helping reduce fatigue during hours of play or work. The adjustable armrests, reclining backrest, and customizable height settings let you fine-tune your seating position for perfect comfort. Covered in durable, easy-to-clean materials, it offers a sleek, modern look that fits seamlessly into any gaming setup or home office. A sturdy base and smooth-rolling casters provide stability and mobility, while the included headrest and lumbar cushions add extra support where you need it most. Whether you''re grinding out long sessions, streaming, or tackling school or work tasks, this gaming chair delivers the comfort, durability, and style every gamer needs.',
  JSON_ARRAY('/images/gaming-chair-product-image.jpeg'),
  180.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Christmas Ornament listing
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
  'Christmas Ornament',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  'This Christmas ornament adds a touch of festive charm and sparkle to your holiday décor, making it a perfect addition to any tree, wreath, or seasonal display. Crafted with attention to detail, it features a beautifully finished design that catches the light from every angle, creating a warm, magical glow throughout your home. Lightweight yet durable, it hangs securely without weighing down branches, ensuring it stays in place all season long. Its classic style blends seamlessly with both modern and traditional decorations, making it a versatile piece you can enjoy year after year. Whether you''re starting a new collection, adding to a cherished tradition, or looking for a thoughtful gift, this ornament brings a timeless, joyful touch to your holiday celebrations.',
  JSON_ARRAY('/images/christmas-ornament-test-image.jpg'),
  12.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;


