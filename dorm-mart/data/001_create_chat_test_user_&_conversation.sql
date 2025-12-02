-- Purge conversations (cascades to participants/messages via FK ON DELETE CASCADE)
DELETE FROM conversations;

-- Optional: reset the auto-increment after the purge
ALTER TABLE conversations AUTO_INCREMENT = 1;

-- Clean any old test users
DELETE FROM user_accounts
WHERE email IN (
  'chatuser1@buffalo.edu',
  'chatuser2@buffalo.edu',
  'chatuser3@buffalo.edu'
);

-- Recreate three users
INSERT INTO user_accounts
  (first_name, last_name, grad_month, grad_year, email, promotional, hash_pass, hash_auth, seller, theme)
VALUES
  ('Chris', 'Kim',       5, 2027, 'chatuser1@buffalo.edu', 0,
   '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO', NULL, 0, 0),
  ('Sameer',   'Jain',      5, 2027, 'chatuser2@buffalo.edu', 0,
   '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO', NULL, 0, 0),
  ('Anish', 'Banerjee',  5, 2027, 'chatuser3@buffalo.edu', 0,
   '$2y$10$GbrdUE1/URrVdrSoa83d1OMfNWeJAuuzyEU4UvMMANKeub4./C.UO', NULL, 0, 0);

-- Capture their IDs and FULL NAMES
-- TRIM(CONCAT_WS(' ', first_name, last_name)) -> "First Last" (handles NULLs, strips extra spaces)
SELECT user_id,
       TRIM(CONCAT_WS(' ', first_name, last_name))
INTO   @uid1, @name1
FROM user_accounts WHERE email = 'chatuser1@buffalo.edu' LIMIT 1;

SELECT user_id,
       TRIM(CONCAT_WS(' ', first_name, last_name))
INTO   @uid2, @name2
FROM user_accounts WHERE email = 'chatuser2@buffalo.edu' LIMIT 1;

SELECT user_id,
       TRIM(CONCAT_WS(' ', first_name, last_name))
INTO   @uid3, @name3
FROM user_accounts WHERE email = 'chatuser3@buffalo.edu' LIMIT 1;

-- Create two 1:1 conversations (store FULL names in user1_fname/user2_fname)
INSERT INTO conversations
  (user1_id, user2_id, user1_fname, user2_fname, user1_deleted, user2_deleted, created_at)
VALUES
  (@uid1, @uid2, @name1, @name2, 0, 0, DATE_SUB(NOW(), INTERVAL 7 DAY)), -- chatuser1 ↔ chatuser2
  (@uid1, @uid3, @name1, @name3, 0, 0, DATE_SUB(NOW(), INTERVAL 3 DAY)); -- chatuser1 ↔ chatuser3

-- Create participants for both sides of each conversation
INSERT INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count)
SELECT c.conv_id, c.user1_id AS user_id, NULL, 0
FROM conversations c
WHERE (c.user1_id, c.user2_id) IN ((@uid1, @uid2), (@uid1, @uid3))
UNION ALL
SELECT c.conv_id, c.user2_id AS user_id, NULL, 0
FROM conversations c
WHERE (c.user1_id, c.user2_id) IN ((@uid1, @uid2), (@uid1, @uid3));

-- Fetch conv_ids for seeding messages
SELECT conv_id INTO @conv_1_2
FROM conversations
WHERE (user1_id = @uid1 AND user2_id = @uid2) OR (user1_id = @uid2 AND user2_id = @uid1)
LIMIT 1;

SELECT conv_id INTO @conv_1_3
FROM conversations
WHERE (user1_id = @uid1 AND user2_id = @uid3) OR (user1_id = @uid3 AND user2_id = @uid1)
LIMIT 1;

-- Seed messages using FULL names in sender_fname/receiver_fname
INSERT INTO messages
  (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, created_at)
VALUES
  (@conv_1_2, @uid1, @uid2, @name1, @name2, 'Hey, you free later?', DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (@conv_1_2, @uid2, @uid1, @name2, @name1, 'Yeah—what''s up?',     DATE_SUB(NOW(), INTERVAL 6 DAY) + INTERVAL 15 MINUTE),
  (@conv_1_2, @uid1, @uid2, @name1, @name2, 'Need a quick review.',  DATE_SUB(NOW(), INTERVAL 6 DAY) + INTERVAL 30 MINUTE),

  (@conv_1_3, @uid1, @uid3, @name1, @name3, 'Anish, pushed the fix.', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (@conv_1_3, @uid3, @uid1, @name3, @name1, 'Got it. Looks good.',    DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 10 MINUTE),
  (@conv_1_3, @uid1, @uid3, @name1, @name3, 'Merging now.',           DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 20 MINUTE);