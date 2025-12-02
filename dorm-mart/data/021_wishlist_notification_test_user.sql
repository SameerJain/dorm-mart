START TRANSACTION;
-- ^ Begin a transaction so the inserts are all-or-nothing.
SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM user_accounts
WHERE email = 'wishlist-receiver@buffalo.edu';

DELETE FROM user_accounts
WHERE email = 'wishlist-sender@buffalo.edu';

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'test',
  'test',
  5,
  2027,
  'wishlist-receiver@buffalo.edu',
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  seller,
  theme
) VALUES (
  'test',
  'test',
  5,
  2027,
  'wishlist-sender@buffalo.edu',
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;


START TRANSACTION;

-- Capture seller user_id for linking records
SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'wishlist-receiver@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Starry Wallpaper', 'Sunset Wallpaper');

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
  'Starry Wallpaper',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  'Nice Wallpaper',
  JSON_ARRAY('/images/starry-wallpaper.jpg'),
  20.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

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
  'Sunset Wallpaper',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  'Beautiful Wallpaper',
  JSON_ARRAY('/images/sunset-wallpaper.png'),
  20.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;
