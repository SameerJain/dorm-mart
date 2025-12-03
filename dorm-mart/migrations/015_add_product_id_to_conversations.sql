-- 015_add_product_id_to_conversations.sql
-- Adds product_id to conversations table to make chats item-specific

ALTER TABLE conversations
ADD COLUMN product_id BIGINT UNSIGNED NULL DEFAULT NULL
AFTER user2_id;

ALTER TABLE conversations
ADD CONSTRAINT fk_conv_product
    FOREIGN KEY (product_id)
    REFERENCES INVENTORY(product_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Add unique index to prevent duplicate item-specific conversations
-- Note: MySQL allows multiple NULL values in unique indexes, so users can have
-- multiple general conversations (product_id = NULL) but only one per product
ALTER TABLE conversations
ADD UNIQUE KEY uq_conv_users_product (user1_id, user2_id, product_id);

