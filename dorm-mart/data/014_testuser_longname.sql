START TRANSACTION;
-- 014_testuser_longname.sql
-- Seed data for test user with maximum length first and last names, and maximum length email
-- Creates account: [242 'w' characters]@buffalo.edu (255 characters total - max allowed)
-- Password: 1234! (same hash as testuser@buffalo.edu)
-- First name: 30 'w' characters (max length per form validation)
-- Last name: 30 'w' characters (max length per form validation)
-- Email: 255 characters total (242 'w' + '@buffalo.edu' = 255)
-- Full email address (copy-paste ready):
-- wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww@buffalo.edu

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM user_accounts
WHERE email = CONCAT(REPEAT('w', 242), '@buffalo.edu');

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
  REPEAT('w', 30),
  REPEAT('w', 30),
  5,
  2027,
  CONCAT(REPEAT('w', 242), '@buffalo.edu'),
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

