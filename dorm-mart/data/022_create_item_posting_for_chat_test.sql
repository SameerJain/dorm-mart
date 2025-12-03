
START TRANSACTION;

SELECT user_id INTO @seller_id
FROM user_accounts
WHERE email = 'chatuser1@buffalo.edu'
LIMIT 1;

-- Delete existing listings if they exist (idempotent cleanup)
DELETE FROM INVENTORY
WHERE title IN ('Nightmoon Wallpaper');

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
  'Nightmoon Wallpaper',
  JSON_ARRAY('Decor'),
  'North Campus',
  'Like New',
  'Nice Wallpaper',
  JSON_ARRAY('/images/nightmoon-wallpaper.jpg'),
  20.00,
  'Active',
  0,
  1,
  CURDATE(),
  @seller_id,
  0
);

COMMIT;