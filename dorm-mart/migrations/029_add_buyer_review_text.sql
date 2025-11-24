-- 029_add_buyer_review_text.sql
-- Adds review_text column to buyer_ratings table for sellers to write reviews about buyers
-- Review text allows sellers to provide detailed feedback about their experience with buyers

ALTER TABLE buyer_ratings 
ADD COLUMN review_text TEXT NOT NULL COMMENT 'Review text from seller about buyer experience';

