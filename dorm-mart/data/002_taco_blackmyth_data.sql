START TRANSACTION;
SET FOREIGN_KEY_CHECKS = 0;

-- DELETE IF EXISTS
DELETE FROM `INVENTORY`
WHERE `product_id` = 3;

INSERT INTO `INVENTORY` (`product_id`, `title`, `categories`, `item_location`, `item_condition`, `description`, `photos`, `listing_price`, `item_status`, `trades`, `price_nego`, `date_listed`, `seller_id`, `sold`, `final_price`, `date_sold`, `sold_to`, `wishlisted`) VALUES
(3, 'Taco', '[\"Kitchen\", \"Food\"]', 'North Campus', 'Like New', 'A taco is a traditional Mexican dish that combines simplicity with bold, layered flavors. It begins with a soft or crispy tortilla, typically made from corn or flour, serving as the perfect vessel for a variety of fillings — from seasoned meats like beef, chicken, or pork, to fresh vegetables, beans, and melted cheese. Topped with salsa, guacamole, cilantro, onions, and a squeeze of lime, each bite delivers a perfect balance of spice, texture, and freshness. Versatile and handheld, tacos are enjoyed everywhere from street vendors to gourmet restaurants, embodying the vibrant, communal spirit of Mexican cuisine in every mouthful.', '[\"/images/img_69049790323853.16461582.jpg\", \"/images/img_69049790324c64.87411742.jpg\", \"/images/img_69049790326125.69260170.jpg\"]', 14.99, 'Active', 1, 0, '2025-10-31', 30, 0, NULL, NULL, NULL, 2);


DELETE FROM `INVENTORY`
WHERE `product_id` = 37;
INSERT INTO `INVENTORY` (`product_id`, `title`, `categories`, `item_location`, `item_condition`, `description`, `photos`, `listing_price`, `item_status`, `trades`, `price_nego`, `date_listed`, `seller_id`, `sold`, `final_price`, `date_sold`, `sold_to`, `wishlisted`) VALUES
(37, 'Black Myth: Wukong (PS5)', '[\"Games\", \"Gaming\", \"Digital\"]', 'North Campus', 'Excellent', '“Black Myth: Wukong” for PlayStation 5 is an action RPG inspired by the legendary Chinese novel Journey to the West. Players step into the role of the Destined One, a warrior with powers reminiscent of the Monkey King, as they battle through a dark and mythic world filled with ancient gods, demons, and mystical creatures. Powered by Unreal Engine 5, the game delivers breathtaking visuals, fluid combat, and cinematic storytelling. With its mix of fast-paced staff combat, magical abilities, and immersive lore, Black Myth: Wukong on PS5 offers a next-generation journey through Chinese mythology that’s both visually stunning and deeply challenging.', '[\"/images/img_69079e06667724.70528259.webp\", \"/images/img_69079e06669053.22043732.jpg\", \"/images/img_69079e0666a868.82689573.jpg\", \"/images/img_69079e0666c195.95980861.png\", \"/images/img_69079e0666d3e6.69670026.webp\", \"/images/img_69079e0666e751.50578486.jpg\"]', 80, 'Active', 0, 1, '2025-11-02', 30, 0, NULL, NULL, NULL, 0);


SET FOREIGN_KEY_CHECKS = 1;
COMMIT;