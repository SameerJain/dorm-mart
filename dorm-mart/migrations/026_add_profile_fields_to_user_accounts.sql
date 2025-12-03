-- Add profile metadata columns to user_accounts table

ALTER TABLE user_accounts
ADD COLUMN profile_photo VARCHAR(255) NULL DEFAULT NULL COMMENT 'URL or path to the user profile photo',
ADD COLUMN bio TEXT NULL COMMENT 'Short biography text supplied by the user',
ADD COLUMN instagram VARCHAR(255) NULL DEFAULT NULL COMMENT 'Instagram handle or profile URL';
