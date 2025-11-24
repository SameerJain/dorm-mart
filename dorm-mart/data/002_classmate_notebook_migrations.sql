START TRANSACTION;
SET FOREIGN_KEY_CHECKS = 0;

-- DELETE IF EXISTS


-- confirm_purchase_requests
DELETE FROM `confirm_purchase_requests`
WHERE `confirm_request_id` = 10;

-- conversations
DELETE FROM `conversations`
WHERE `conv_id` = 8;

-- conversation_participants
DELETE FROM `conversation_participants`
WHERE `conv_id` = 8 AND `user_id` IN (58, 59);

-- INVENTORY
DELETE FROM `INVENTORY`
WHERE `product_id` = 59;

-- messages
DELETE FROM `messages` WHERE `message_id` IN (159,160,161,162,163,164);

-- product_reviews
DELETE FROM `product_reviews`
WHERE `review_id` = 8;

-- purchase_history
DELETE FROM `purchase_history`
WHERE `history_id` = 7;

-- scheduled_purchase_requests
DELETE FROM `scheduled_purchase_requests`
WHERE `request_id` = 39;


-- INSERT STATEMENTS


INSERT INTO `confirm_purchase_requests` (`confirm_request_id`, `scheduled_request_id`, `inventory_product_id`, `seller_user_id`, `buyer_user_id`, `conversation_id`, `is_successful`, `final_price`, `seller_notes`, `failure_reason`, `failure_reason_notes`, `status`, `expires_at`, `buyer_response_at`, `auto_processed_at`, `payload_snapshot`, `created_at`, `updated_at`) VALUES
(10, 39, 59, 59, 58, 8, 1, '4.00', 'Price increased', NULL, NULL, 'buyer_accepted', '2020-11-19 00:18:48', '2020-11-14 06:20:05', NULL, '{\"buyer_id\": 58, \"is_trade\": false, \"seller_id\": 59, \"item_title\": \"Classmate Notebook\", \"meeting_at\": \"2020-11-17T18:00:00+00:00\", \"description\": \"Buyer wants this\", \"meet_location\": \"North Campus\", \"negotiated_price\": 3, \"trade_item_description\": null}', '2020-11-14 06:20:05', '2025-11-18 00:34:07');

INSERT INTO `conversations` (`conv_id`, `user1_id`, `user2_id`, `product_id`, `user1_fname`, `user2_fname`, `user1_deleted`, `user2_deleted`, `created_at`) VALUES
(8, 58, 59, 59, 'testA general-test-user', 'testB general-test-user', 0, 0, '2020-11-15 00:15:01');

INSERT INTO `conversation_participants` (`conv_id`, `user_id`, `first_unread_msg_id`, `unread_count`) VALUES
(8, 58, 0, 0),
(8, 59, 0, 0);

INSERT INTO `INVENTORY` (`product_id`, `title`, `categories`, `item_location`, `item_condition`, `description`, `photos`, `listing_price`, `item_status`, `trades`, `price_nego`, `date_listed`, `seller_id`, `sold`, `final_price`, `date_sold`, `sold_to`, `wishlisted`) VALUES
(59, 'Classmate Notebook', '[\"Books\"]', 'North Campus', 'Like New', 'This is a classmate notebook.', '[\"/images/img_6916c9c84c2f92.99812352.webp\"]', 3, 'Sold', 0, 1, '2020-11-14', 59, 1, 4, '2020-11-14', 58, 0);

INSERT INTO `messages` (`message_id`, `conv_id`, `sender_id`, `receiver_id`, `sender_fname`, `receiver_fname`, `content`, `image_url`, `metadata`, `created_at`, `edited_at`) VALUES
(159, 8, 58, 59, 'testA general-test-user', 'testB general-test-user', 'testA general-test-user would like to message you about Classmate Notebook', NULL, '{\"type\":\"listing_intro\",\"product\":{\"product_id\":59,\"title\":\"Classmate Notebook\",\"image_url\":\"/images/img_6916c9c84c2f92.99812352.webp\"},\"buyer_name\":\"testA general-test-user\"}', '2020-11-15 00:15:01', NULL),
(160, 8, 58, 59, 'testA general-test-user', 'testB general-test-user', 'Hey I want this', NULL, NULL, '2020-11-15 00:15:05', NULL),
(161, 8, 59, 58, 'testB general-test-user', 'testA general-test-user', 'testB general-test-user has scheduled a purchase. Please Accept or Deny.', NULL, '{\"type\":\"schedule_request\",\"request_id\":39,\"inventory_product_id\":59,\"product_id\":59,\"product_title\":\"Classmate Notebook\",\"meeting_at\":\"2025-11-18T23:00:00+00:00\",\"meet_location\":\"North Campus\",\"verification_code\":\"N57U\",\"description\":\"Buyer wants this\",\"negotiated_price\":2.99,\"listing_price\":3,\"is_trade\":false,\"trade_item_description\":null}', '2020-11-15 00:17:26', NULL),
(162, 8, 58, 59, 'testA general-test-user', 'testB general-test-user', 'testA general-test-user has accepted the scheduled purchase.', NULL, '{\"type\":\"schedule_accepted\",\"request_id\":39}', '2020-11-15 00:17:31', NULL),
(163, 8, 59, 58, 'testB general-test-user', 'testA general-test-user', 'testB general-test-user submitted a Confirm Purchase form for Classmate Notebook.', NULL, '{\"type\":\"confirm_request\",\"confirm_request_id\":21,\"scheduled_request_id\":39,\"inventory_product_id\":59,\"product_title\":\"Classmate Notebook\",\"buyer_user_id\":58,\"seller_user_id\":59,\"is_successful\":true,\"final_price\":4,\"seller_notes\":\"\",\"failure_reason\":null,\"failure_reason_notes\":null,\"meet_location\":\"North Campus\",\"meeting_at\":\"2025-11-18T23:00:00+00:00\",\"expires_at\":\"2025-11-19T00:18:48+00:00\",\"snapshot\":{\"item_title\":\"Classmate Notebook\",\"buyer_id\":58,\"seller_id\":59,\"meet_location\":\"North Campus\",\"meeting_at\":\"2025-11-18T23:00:00+00:00\",\"description\":\"Buyer wants this\",\"negotiated_price\":2.99,\"trade_item_description\":null,\"is_trade\":false}}', '2020-11-15 00:18:48', NULL),
(164, 8, 58, 59, 'testA general-test-user', 'testB general-test-user', 'testA general-test-user accepted the Confirm Purchase form.', NULL, '{\"type\":\"confirm_accepted\",\"confirm_request_id\":21,\"scheduled_request_id\":39,\"inventory_product_id\":59,\"is_successful\":true,\"final_price\":4,\"seller_notes\":\"\",\"failure_reason\":null,\"failure_reason_notes\":null,\"snapshot\":{\"buyer_id\":58,\"is_trade\":false,\"seller_id\":59,\"item_title\":\"Classmate Notebook\",\"meeting_at\":\"2025-11-18T23:00:00+00:00\",\"description\":\"Buyer wants this\",\"meet_location\":\"North Campus\",\"negotiated_price\":2.99,\"trade_item_description\":null},\"responded_at\":\"2025-11-18T00:18:52+00:00\"}', '2020-11-15 00:18:52', NULL);

INSERT INTO `product_reviews` (`review_id`, `product_id`, `buyer_user_id`, `seller_user_id`, `rating`, `product_rating`, `review_text`, `image1_url`, `image2_url`, `image3_url`, `created_at`, `updated_at`) VALUES
(8, 75, 30, 73, '4.0', '4.0', 'This was cool!', '/media/review-images/review_u30_20251117_231135_db6daf62cc90.jpg', NULL, NULL, '2025-11-17 23:11:39', NULL);

INSERT INTO `purchase_history` (`history_id`, `user_id`, `items`, `created_at`, `updated_at`) VALUES
(7, 58, '[{\"product_id\": 59, \"recorded_at\": \"2020-11-14T06:20:05+00:00\", \"confirm_payload\": {\"final_price\": 4, \"seller_notes\": \"\", \"auto_accepted\": false, \"is_successful\": true, \"failure_reason\": null, \"confirm_request_id\": 21, \"failure_reason_notes\": null}}]', '2020-11-15 00:18:52', NULL);

INSERT INTO `scheduled_purchase_requests` (`request_id`, `inventory_product_id`, `seller_user_id`, `buyer_user_id`, `conversation_id`, `meet_location`, `meeting_at`, `verification_code`, `description`, `negotiated_price`, `is_trade`, `trade_item_description`, `snapshot_price_nego`, `snapshot_trades`, `snapshot_meet_location`, `status`, `canceled_by_user_id`, `buyer_response_at`, `created_at`, `updated_at`) VALUES
(39, 59, 59, 58, 8, 'North Campus', '2020-11-17 18:00:00', 'N57U', 'Buyer wants this', '3.00', 0, NULL, 1, 0, 'North Campus', 'accepted', NULL, '2020-11-14 00:17:31', '2020-11-15 00:17:26', '2025-11-18 00:34:51');

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
