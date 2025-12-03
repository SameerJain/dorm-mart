START TRANSACTION;
-- ^ Begin a transaction so the insert is all-or-nothing.

DELETE FROM user_accounts
WHERE email = 'testusersellerdashboard@buffalo.edu';

INSERT INTO user_accounts (
  first_name,
  last_name,
  grad_month,
  grad_year,
  email,
  promotional,
  hash_pass,
  hash_auth,
  join_date,
  seller,
  theme,
  reset_token_expires,
  last_reset_request,
  received_intro_promo_email,
  reveal_contact_info,
  interested_category_1,
  interested_category_2,
  interested_category_3
) VALUES (
  'Test',
  'User',
  5,
  2027,
  'testusersellerdashboard@buffalo.edu',
  0,
  '$2y$10$ybNS2QE7ybMophy8WuJrAOdC3JxaiyY1MI18Wlha4mxTYVoyLTJFi',
  NULL,
  '2025-10-31',
  1,
  0,
  NULL,
  NULL,
  0,
  0,
  NULL,
  NULL,
  NULL
);

COMMIT;

