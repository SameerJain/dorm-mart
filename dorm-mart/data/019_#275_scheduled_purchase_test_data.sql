START TRANSACTION;
-- 019_#275_scheduled_purchase_test_data.sql
-- Seed data for scheduled purchase feature testing
-- Adds Laundry Bag, House Plant, and Small Heater product listings for testuserschedulered@buffalo.edu (Luke Skywalker)
-- These items are used to test the scheduled purchase functionality
-- Note: Conversations are created via "Message Seller" button in UI, not in this migration

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'testuserschedulered@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Laundry Bag', 'House Plant', 'Small Heater');

-- Insert Laundry Bag listing
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
  'Laundry Bag',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Like New',
  'This laundry bag offers a simple, durable solution for organizing and transporting your clothes, making it perfect for dorms, apartments, travel, or everyday household use. Made from sturdy, tear-resistant fabric, it holds a generous amount of laundry without stretching or losing shape. The breathable material helps reduce odors, while the secure drawstring closure keeps clothes contained and easy to carry. Lightweight yet strong, it folds flat when not in use, saving valuable storage space. The reinforced handles provide comfortable lifting, whether you''re heading to the washer, the laundromat, or packing for a trip. With its clean, functional design and reliable construction, this laundry bag makes managing laundry easier, more organized, and more efficient for busy lifestyles.',
  JSON_ARRAY('/images/laundry-bag-product-image.webp'),
  12.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

-- Insert House Plant listing
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
  'House Plant',
  JSON_ARRAY('Decor', 'Dorm Essentials'),
  'North Campus',
  'Like New',
  'This house plant brings a refreshing touch of natural beauty to any indoor space, making it an easy way to brighten your home, office, or dorm. With lush, vibrant foliage and a clean, modern look, it enhances your décor while helping create a calmer, more inviting atmosphere. Designed to thrive indoors, it grows well with minimal care—just occasional watering and indirect sunlight—making it perfect for beginners and experienced plant lovers alike. Its compact yet full shape fits beautifully on desks, shelves, window ledges, or tabletop displays, adding life without taking up too much space. The sturdy pot provides stable support and blends effortlessly with a wide range of interior styles. Whether you want to purify the air, elevate your décor, or simply enjoy the presence of greenery, this house plant offers a low-maintenance, visually appealing way to bring nature indoors.',
  JSON_ARRAY('/images/small-splant-product-image.jpg'),
  15.00,
  'Active',
  0,
  0,
  CURDATE(),
  @seller_id,
  0
);

-- Insert Small Heater listing
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
  'Small Heater',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Like New',
  'This small heater delivers powerful, focused warmth in a compact design, making it perfect for bedrooms, offices, dorms, or any space that needs a quick temperature boost. Featuring efficient ceramic heating technology, it warms up fast and distributes heat evenly, helping you stay comfortable during cold mornings or chilly nights. The simple controls allow you to adjust settings with ease, while built-in safety features—such as overheat protection and a tip-over shutoff—provide added peace of mind. Lightweight and portable, it''s easy to move from room to room, and its quiet operation ensures it won''t interrupt work, sleep, or relaxation. With its sleek, space-saving design and dependable performance, this small heater is an ideal solution for staying warm and cozy all season long.',
  JSON_ARRAY('/images/small-heater-product-image.webp'),
  35.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;







