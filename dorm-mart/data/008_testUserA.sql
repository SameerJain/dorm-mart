START TRANSACTION;
-- ^ Begin a transaction so the insert is all-or-nothing.
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM user_accounts
WHERE email = 'testuserA@buffalo.edu';

INSERT INTO user_accounts (
  user_id,
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
  58,
  'testA',
  'general-test-user',
  5,
  2027,
  'testuserA@buffalo.edu',
  0,
  '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO',
  NULL,
  0,
  0
);
SET FOREIGN_KEY_CHECKS = 1;
COMMIT;


