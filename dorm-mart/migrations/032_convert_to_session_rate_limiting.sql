-- Migration 032: Convert rate limiting from email-based to session-based
-- Author: Rate Limiting Security Update
-- Date: 2025-01-XX
-- Description: Removes email-based rate limiting columns from user_accounts and creates session-based login_rate_limits table

-- Drop rate limiting columns from user_accounts table
SET @sql1 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'failed_login_attempts') > 0,
    'ALTER TABLE user_accounts DROP COLUMN failed_login_attempts',
    'SELECT "Column failed_login_attempts does not exist"'
));
PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @sql2 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'last_failed_attempt') > 0,
    'ALTER TABLE user_accounts DROP COLUMN last_failed_attempt',
    'SELECT "Column last_failed_attempt does not exist"'
));
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @sql3 = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'user_accounts' 
     AND COLUMN_NAME = 'lockout_until') > 0,
    'ALTER TABLE user_accounts DROP COLUMN lockout_until',
    'SELECT "Column lockout_until does not exist"'
));
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- Create login_rate_limits table for session-based rate limiting
CREATE TABLE IF NOT EXISTS login_rate_limits (
    session_id VARCHAR(128) NOT NULL PRIMARY KEY,
    failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    last_failed_attempt TIMESTAMP NULL DEFAULT NULL,
    lockout_until DATETIME NULL DEFAULT NULL COMMENT "When the session lockout expires",
    INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

