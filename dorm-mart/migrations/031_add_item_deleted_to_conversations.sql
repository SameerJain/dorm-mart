-- 031_add_item_deleted_to_conversations.sql
-- Adds item_deleted column to conversations table to track when an item associated with a conversation has been deleted

ALTER TABLE conversations
ADD COLUMN item_deleted BOOLEAN NOT NULL DEFAULT FALSE
AFTER product_id;

