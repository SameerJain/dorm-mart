START TRANSACTION;
-- 020_seed_realistic_marketplace_data.sql
-- Seed data for 4 user accounts and 12 product listings
-- Creates realistic marketplace data with diverse items across different categories
-- Each account has 3 unique items (no duplicates across accounts)

-- Password hash for "1234!" for all accounts
SET @password_hash = '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO';

-- ============================================
-- ACCOUNT 1: Lisa Patterson
-- ============================================
DELETE FROM user_accounts WHERE email = 'lisapatterson@buffalo.edu';

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
  'Lisa',
  'Patterson',
  5,
  2026,
  'lisapatterson@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @lisa_id = LAST_INSERT_ID();

-- Item 1: Storage Bin For Room
DELETE FROM INVENTORY WHERE title = 'Storage Bin For Room' AND seller_id = @lisa_id;

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
  'Storage Bin For Room',
  JSON_ARRAY('Dorm Essentials', 'Utility'),
  'North Campus',
  'Fair',
  'This storage bin is a simple, stylish solution for keeping any room neat, organized, and clutter-free. Designed with a sturdy structure and soft fabric exterior, it blends easily with most décor styles while offering dependable everyday use. The spacious interior provides plenty of room for clothes, blankets, books, toys, or miscellaneous items that need a dedicated home. Reinforced handles on each side make it easy to pull from shelves, lift, or carry around the room, while the lightweight build ensures effortless movement. Its foldable design allows the bin to collapse flat when not in use, helping save space and simplify storage. The clean, minimalist look fits seamlessly in bedrooms, dorms, closets, or living areas, adding both function and a touch of warmth. Whether placed on a shelf, tucked under a bed, or used as a standalone organizer, this storage bin offers a practical, versatile way to maintain order while enhancing the overall tidiness of your space.',
  JSON_ARRAY('/images/storage-bin-product-image.jpg'),
  15.99,
  'Active',
  0,
  1,
  CURDATE(),
  @lisa_id,
  0
);

-- Item 2: Suit Hangar Pack
DELETE FROM INVENTORY WHERE title = 'Suit Hangar Pack' AND seller_id = @lisa_id;

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
  'Suit Hangar Pack',
  JSON_ARRAY('Dorm Essentials', 'Clothing'),
  'South Campus',
  'Like New',
  'This suit hangers pack offers a reliable, space-saving solution for keeping your wardrobe looking sharp and well-organized. Each hanger is crafted with a strong, durable frame designed to support the structure of suits, blazers, coats, and dress shirts without bending or warping over time. The contoured shoulder shape helps garments maintain their natural form, preventing unwanted creases and keeping jackets ready to wear. A non-slip coating or bar ensures pants stay securely in place, eliminating the hassle of slipping fabrics. Lightweight yet sturdy, these hangers maximize closet space while maintaining a polished, uniform look. Ideal for home closets, dorm rooms, or professional settings, this pack provides consistent quality and convenience for anyone looking to elevate their clothing care routine. Whether you''re storing business attire, special-occasion outfits, or everyday staples, these suit hangers offer dependable support, neat organization, and a refined presentation that keeps your wardrobe at its best.',
  JSON_ARRAY('/images/suit-hangers-product-image.jpg'),
  18.00,
  'Active',
  1,
  0,
  CURDATE(),
  @lisa_id,
  0
);

-- Item 3: Small Desk Mirror
DELETE FROM INVENTORY WHERE title = 'Small Desk Mirror' AND seller_id = @lisa_id;

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
  'Small Desk Mirror',
  JSON_ARRAY('Dorm Essentials', 'Bed', 'Utility'),
  'Ellicott',
  'Excellent',
  'This desk mirror offers a clean, modern design that enhances any workspace, vanity, or bedroom setup with both style and practicality. Built with a sturdy base and smooth, stable frame, it stays firmly in place while you get ready, do your skincare routine, or handle quick touch-ups throughout the day. The crystal-clear reflective surface provides sharp, accurate visibility, making tasks like makeup application, grooming, or adjusting accessories easier and more precise. Its compact size fits comfortably on desks, shelves, and countertops without taking up unnecessary space, while still offering a generous viewing area. Many models feature adjustable angles, allowing you to tilt the mirror to your preferred position for optimal lighting and comfort. Lightweight and easy to move, it can be relocated around your room or packed for travel without hassle. Whether used for daily routines or quick checks between tasks, this desk mirror adds convenience, simplicity, and a polished touch to any personal space.',
  JSON_ARRAY('/images/desk-mirror-product-image.webp'),
  35.00,
  'Active',
  1,
  1,
  CURDATE(),
  @lisa_id,
  0
);


-- ============================================
-- ACCOUNT 2: Sadiq Khan
-- ============================================
DELETE FROM user_accounts WHERE email = 'sadiqkhan@buffalo.edu';

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
  'Sadiq',
  'Khan',
  5,
  2026,
  'sadiqkhan@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @sadiq_id = LAST_INSERT_ID();

-- Item 4: Bob Marley Poster
DELETE FROM INVENTORY WHERE title = 'Bob Marley Poster' AND seller_id = @sadiq_id;

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
  'Bob Marley Poster',
  JSON_ARRAY('Decor', 'Misc.'),
  'Other',
  'Like New',
  'This Bob Marley poster brings timeless style and cultural energy to any room, celebrating the legendary musician whose message of peace, unity, and resilience still resonates today. Printed with rich, high-quality inks, the artwork captures Marley''s iconic presence, highlighting his expressive features, signature dreadlocks, and the warm, nostalgic tones often associated with reggae culture. The poster''s smooth finish enhances color depth and clarity, giving it a vibrant, polished look that stands out on dorm walls, bedrooms, music rooms, or creative spaces. Its durable paper resists fading, ensuring the image stays sharp even after long-term display. Lightweight and easy to frame, hang, or mount with clips or adhesive strips, it offers flexible decorating options to suit your style. Whether you''re a dedicated fan of reggae, a collector of music art, or simply looking to add personality to a blank wall, this Bob Marley poster brings character, inspiration, and a touch of soulful rhythm to your space.',
  JSON_ARRAY('/images/bob-marley-poster-product-image.jpg'),
  24.99,
  'Active',
  1,
  0,
  CURDATE(),
  @sadiq_id,
  0
);

-- Item 5: Playstation 2
DELETE FROM INVENTORY WHERE title = 'Playstation 2' AND seller_id = @sadiq_id;

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
  'Playstation 2',
  JSON_ARRAY('Gaming', 'Games'),
  'Other',
  'Fair',
  'The PlayStation 2 remains one of the most iconic gaming consoles ever made, offering a blend of nostalgia, reliability, and timeless entertainment. Its sleek, compact design fits easily into any setup, while the signature matte finish and angular edges give it a classic look that still feels modern. Known for its massive game library, the PS2 supports thousands of titles across action, sports, RPGs, and family-friendly genres, making it the perfect system for collectors, retro gamers, or anyone revisiting childhood favorites. With smooth disc playback, intuitive controls, and quick startup, it delivers a simple, satisfying gaming experience without unnecessary complications. It also doubles as a DVD player, adding extra versatility for media lovers. Whether you''re rediscovering beloved franchises, building a retro collection, or introducing classic games to new players, the PlayStation 2 offers enduring fun, dependable performance, and the charm of one of gaming''s most legendary consoles.',
  JSON_ARRAY('/images/playstation-2-product-image.jpg'),
  50.00,
  'Active',
  0,
  1,
  CURDATE(),
  @sadiq_id,
  0
);

-- Item 6: Mini LED Monitor
DELETE FROM INVENTORY WHERE title = 'Mini LED Monitor' AND seller_id = @sadiq_id;

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
  'Mini LED Monitor',
  JSON_ARRAY('Electronics', 'Gaming', 'Games'),
  'South Campus',
  'Like New',
  'This Mini LED Monitor delivers impressive clarity and portability, making it the perfect companion for work, gaming, travel, and creative projects. Its vibrant LED display provides sharp resolution, rich color accuracy, and smooth motion, giving you a crisp viewing experience whether you''re editing photos, watching videos, or extending your laptop or console screen. Lightweight and ultra-slim, it fits easily into backpacks, desk setups, or small workspaces without adding clutter. The monitor features multiple connectivity options—such as HDMI and USB-C—ensuring quick, reliable plug-and-play compatibility with laptops, gaming systems, tablets, and more. Its adjustable stand allows comfortable viewing angles, while the durable frame protects the screen during daily use or travel. Ideal for students, professionals, and gamers who need extra visual space on the go, this Mini LED Monitor offers convenience, versatility, and high-quality performance in a compact, modern design.',
  JSON_ARRAY('/images/mini-led-monitor-product-image.jpg'),
  80.00,
  'Active',
  0,
  1,
  CURDATE(),
  @sadiq_id,
  0
);


-- ============================================
-- ACCOUNT 3: Michelle Romano
-- ============================================
DELETE FROM user_accounts WHERE email = 'michelleromano@buffalo.edu';

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
  'Michelle',
  'Romano',
  5,
  2026,
  'michelleromano@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @michelle_id = LAST_INSERT_ID();

-- Item 7: Frying Pan
DELETE FROM INVENTORY WHERE title = 'Frying Pan' AND seller_id = @michelle_id;

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
  'Frying Pan',
  JSON_ARRAY('Kitchen', 'Food'),
  'Ellicott',
  'Fair',
  'This frying pan is designed to deliver reliable performance, everyday convenience, and long-lasting durability, making it an essential tool for any kitchen. Crafted with a sturdy, heat-efficient base, it distributes warmth evenly to help prevent hotspots and ensure consistent cooking results whether you''re sautéing vegetables, searing meats, frying eggs, or preparing quick weeknight meals. The smooth nonstick interior allows food to release effortlessly, reducing the need for excess oil and making cleanup fast and simple. Its comfortable, stay-cool handle offers a secure grip for easy maneuvering, while the lightweight construction keeps it practical for daily use. Compatible with most stovetops, this pan is versatile enough for beginners, home cooks, and meal-prep enthusiasts. Designed to withstand frequent use without warping, scratching, or losing its coating, it''s a dependable kitchen staple that brings convenience, efficiency, and great results to your cooking routine.',
  JSON_ARRAY('/images/frying-pan-product-image.jpg'),
  20.00,
  'Active',
  1,
  0,
  CURDATE(),
  @michelle_id,
  0
);

-- Item 8: Desk Lamp
DELETE FROM INVENTORY WHERE title = 'Desk Lamp' AND seller_id = @michelle_id;

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
  'Desk Lamp',
  JSON_ARRAY('Misc.', 'Utility'),
  'Other',
  'Excellent',
  'This desk lamp offers bright, focused lighting designed to enhance productivity, comfort, and style in any workspace. Its sleek, modern design fits seamlessly on desks, nightstands, or study areas, while the adjustable arm and pivoting head let you direct light exactly where you need it—perfect for reading, writing, crafting, or long computer sessions. Multiple brightness levels allow you to switch from soft ambient glow to crisp task lighting, reducing eye strain and creating the ideal atmosphere for work or relaxation. Energy-efficient LED bulbs provide long-lasting illumination without overheating, keeping your space cool and comfortable. The stable base ensures steady positioning, and intuitive controls make adjustments simple and quick. Compact yet powerful, this lamp is ideal for students, professionals, and home offices, offering reliable lighting, thoughtful design, and the versatility needed for daily tasks.',
  JSON_ARRAY('/images/desk-lamp-product-image.jpg'),
  50.00,
  'Active',
  1,
  1,
  CURDATE(),
  @michelle_id,
  0
);

-- Item 9: Lysol Air Freshner Pack
DELETE FROM INVENTORY WHERE title = 'Lysol Air Freshner Pack' AND seller_id = @michelle_id;

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
  'Lysol Air Freshner Pack',
  JSON_ARRAY('Utility', 'Dorm Essentials'),
  'North Campus',
  'Excellent',
  'This Lysol pack provides a dependable, all-in-one cleaning solution designed to keep your home fresh, sanitized, and protected from everyday germs. Each product is formulated with powerful disinfecting agents that eliminate bacteria, viruses, and grime on high-touch surfaces like countertops, doorknobs, appliances, and bathroom fixtures. The convenient multi-item pack ensures you always have the right cleaner on hand—whether you''re tackling quick wipe-downs, deep cleaning sessions, or routine household maintenance. The crisp, clean scent leaves rooms smelling refreshed without being overwhelming, while the fast-acting formula works in seconds to cut through messes and restore surfaces. Ideal for kitchens, bathrooms, offices, and shared spaces, this Lysol pack is perfect for busy households, students, and anyone who values a healthier environment. With reliable performance, easy-to-use packaging, and trusted brand quality, it helps make daily cleaning simpler, faster, and more effective.',
  JSON_ARRAY('/images/lysol-pack-product-image.jpeg'),
  15.00,
  'Active',
  0,
  1,
  CURDATE(),
  @michelle_id,
  0
);

-- ============================================
-- ACCOUNT 4: Shawn Brockmeyer
-- ============================================
DELETE FROM user_accounts WHERE email = 'shawnbrockmeyer@buffalo.edu';

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
  'Shawn',
  'Brockmeyer',
  5,
  2026,
  'shawnbrockmeyer@buffalo.edu',
  0,
  @password_hash,
  NULL,
  1,
  0
);

SET @shawn_id = LAST_INSERT_ID();

-- Item 10 (for Shawn): African American History Textbook
DELETE FROM INVENTORY WHERE title = 'African American History Textbook' AND seller_id = @shawn_id;

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
  'African American History Textbook',
  JSON_ARRAY('School'),
  'North Campus',
  'Like New',
  'Freedom on My Mind is a comprehensive, engaging textbook that explores African American history with depth, clarity, and powerful storytelling. Designed for both students and educators, it blends vivid primary sources, insightful analysis, and well-organized chapters to highlight the central role of Black experiences in shaping the United States. The book traces key themes—struggle, resilience, activism, and cultural identity—while placing historical moments in a broader social and political context. Clear visuals, maps, and firsthand accounts help bring the narrative to life, making complex topics accessible without oversimplifying them. Whether used for classroom study or personal learning, Freedom on My Mind supports critical thinking, encourages discussion, and offers a nuanced, evidence-based look at the African American past. Its balanced structure and rich content make it a reliable, informative resource for anyone seeking a deeper understanding of American history.',
  JSON_ARRAY('/images/african-american-history-textbook-product-image.jpg'),
  30.00,
  'Active',
  1,
  1,
  CURDATE(),
  @shawn_id,
  0
);

-- Item 11 (for Shawn): Steam Iron
DELETE FROM INVENTORY WHERE title = 'Steam Iron' AND seller_id = @shawn_id;

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
  'Steam Iron',
  JSON_ARRAY('Clothing', 'Electronics'),
  'South Campus',
  'Excellent',
  'This steam iron delivers fast, effective wrinkle removal with a powerful burst of steam designed to smooth everything from delicate fabrics to heavy cotton. Its nonstick soleplate glides effortlessly across clothing, ensuring even heat distribution for crisp, polished results every time. With adjustable steam settings, you can tailor the output to suit different materials, preventing damage while achieving professional-level finishes. The iron heats quickly, helping you tackle last-minute touch-ups without delay, and the convenient spray function adds extra precision for stubborn creases. A comfortable, ergonomic handle provides steady control, while the anti-drip design keeps water from spotting your garments. The large water tank allows longer ironing sessions between refills, and the self-clean feature helps maintain performance over time. Ideal for everyday use, dorms, apartments, or busy households, this steam iron brings efficiency, reliability, and smooth, wrinkle-free results to your laundry routine.',
  JSON_ARRAY('/images/steam-iron-product-image.webp'),
  45.00,
  'Active',
  1,
  0,
  CURDATE(),
  @shawn_id,
  0
);

-- Item 12 (for Shawn): Swiffer
DELETE FROM INVENTORY WHERE title = 'Swiffer' AND seller_id = @shawn_id;

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
  'Swiffer',
  JSON_ARRAY('Dorm Essentials', 'Misc.'),
  'North Campus',
  'Like New',
  'This Swiffer provides an easy, efficient way to keep floors and surfaces clean, capturing dust, dirt, and hair with minimal effort. Designed with a lightweight, flexible handle and a wide cleaning head, it glides smoothly under furniture, around corners, and across hard-to-reach spots. The disposable dry pads lock in debris using textured ridges and electrostatic fibers, making everyday touch-ups fast and mess-free. For deeper cleaning, the wet pads deliver a fresh, thorough wipe that removes grime and leaves floors looking bright and refreshed. Ideal for hardwood, tile, laminate, and vinyl, the Swiffer is perfect for busy households, pet owners, and anyone who wants a quick, reliable cleaning routine without heavy tools or buckets. Its slim profile makes it easy to store, while the simple pad replacement system keeps maintenance stress-free. With its versatility and convenience, this Swiffer helps maintain a cleaner home with less time and effort.',
  JSON_ARRAY('/images/swiffer-product-image.jpg'),
  15.00,
  'Active',
  1,
  1,
  CURDATE(),
  @shawn_id,
  0
);

COMMIT;

