-- 014_add_metadata_to_messages.sql
-- Adds metadata column to messages table for storing JSON metadata (e.g., listing_intro messages)

ALTER TABLE messages
ADD COLUMN metadata TEXT NULL DEFAULT NULL
AFTER content;

