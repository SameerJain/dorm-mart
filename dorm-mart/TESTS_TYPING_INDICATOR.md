# Typing Indicator Test Cases

This document contains comprehensive test cases for the typing indicator feature. These tests verify the actual code functionality including API endpoints, database operations, polling mechanisms, timeouts, and error handling.

## Prerequisites

- Access to CSE 442 Development Server: https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/
- Two test user accounts:
  - `testuser@buffalo.edu` / `1234!`
  - `testuserschedulered@buffalo.edu` / `1234!`
- Access to phpMyAdmin: https://aptitude.cse.buffalo.edu/phpmyadmin/
  - Username: `sameerja`
  - Password: `50517455`
  - Database: `cse442_2025_fall_team_j_db`
- Chrome DevTools for network monitoring
- A conversation between the two test users (e.g., conversation about "Anker Portable Charger")

---

## Test 1: Verify POST /api/chat/typing_status.php Correctly Updates Database

**Type:** Backend API Test  
**Priority:** High  
**Objective:** Verify that the typing status API endpoint correctly inserts and updates typing status in the database with proper transaction handling and access control.

### Prerequisites
- Two browser windows logged in as different users
- Both users have access to the same conversation
- Access to phpMyAdmin

### Steps

1. **Test Initial Insert (typing=true)**
   - In Browser 1 (testuser@buffalo.edu), open Chrome DevTools → Network tab
   - Navigate to the chat page and open a conversation with the other test user
   - In Browser 2 (testuserschedulered@buffalo.edu), open the same conversation
   - In Browser 2, start typing in the message input field
   - In Browser 1 DevTools, verify a POST request to `/api/chat/typing_status.php` is made
   - Check the request payload: `{ conversation_id: <id>, is_typing: true }`
   - Verify response: `{ success: true }`
   - In phpMyAdmin, query: `SELECT * FROM typing_status WHERE conversation_id = <conv_id> AND user_id = <user2_id>`
   - **Expected:** Row exists with `is_typing = 1` and `updated_at` is recent (within last second)

2. **Test Update Existing Status (typing=false)**
   - Wait 3 seconds after stopping typing in Browser 2
   - In Browser 1 DevTools, verify another POST request to `/api/chat/typing_status.php` is made
   - Check the request payload: `{ conversation_id: <id>, is_typing: false }`
   - Verify response: `{ success: true }`
   - In phpMyAdmin, query the same row again
   - **Expected:** Same row now has `is_typing = 0` and `updated_at` is updated

3. **Test ON DUPLICATE KEY UPDATE**
   - In Browser 2, type again quickly (within 1 second)
   - In Browser 1 DevTools, verify multiple POST requests are made
   - In phpMyAdmin, query: `SELECT COUNT(*) FROM typing_status WHERE conversation_id = <conv_id> AND user_id = <user2_id>`
   - **Expected:** Only 1 row exists (not multiple rows), proving ON DUPLICATE KEY UPDATE works

4. **Test Access Control (Unauthorized Conversation)**
   - In Browser 2, note a conversation_id that Browser 1 does NOT have access to
   - In Browser 2 DevTools Console, manually execute:
     ```javascript
     fetch('/api/chat/typing_status.php', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({ conversation_id: <unauthorized_conv_id>, is_typing: true })
     }).then(r => r.json()).then(console.log)
     ```
   - **Expected:** Response has `success: false` and `error: 'Access denied'` with HTTP 403 status

5. **Test Transaction Atomicity**
   - In phpMyAdmin, manually set `is_typing = 0` for the test row
   - In Browser 2, type again
   - Immediately after the POST request completes, check database
   - **Expected:** Row is updated atomically (no intermediate states visible)

### Expected Outcomes
- POST endpoint correctly inserts new typing status records
- POST endpoint correctly updates existing typing status records using ON DUPLICATE KEY UPDATE
- Only one row exists per (conversation_id, user_id) combination
- Access control prevents users from updating typing status for conversations they're not in
- Database updates are atomic (transaction-based)

### Fails If
- Multiple rows are created for the same conversation_id + user_id
- Updates don't work (always inserts new rows)
- Unauthorized users can update typing status for conversations they don't belong to
- Database shows inconsistent state during updates

---

## Test 2: Verify GET /api/chat/fetch_new_messages.php Returns Typing Status Within 8-Second Window

**Type:** Backend API Test  
**Priority:** High  
**Objective:** Verify that the fetch_new_messages endpoint correctly returns typing status only when it was updated within the last 8 seconds, and filters by the correct user_id.

### Prerequisites
- Two browser windows logged in as different users
- Both users have access to the same conversation
- Access to phpMyAdmin

### Steps

1. **Test Typing Status Returned When Fresh (< 8 seconds)**
   - In Browser 2 (testuserschedulered@buffalo.edu), start typing
   - Wait for POST request to complete (typing_status.php)
   - In Browser 1 DevTools → Network tab, monitor requests to `fetch_new_messages.php`
   - Wait for the next polling request (should occur within ~250ms)
   - Check the response JSON structure
   - **Expected:** Response includes `typing_status: { is_typing: true, typing_user_first_name: '<first_name>' }`

2. **Test Typing Status Expires After 8 Seconds**
   - In Browser 2, stop typing and wait 3 seconds (for typing=false to be sent)
   - In phpMyAdmin, verify: `SELECT updated_at FROM typing_status WHERE conversation_id = <conv_id> AND user_id = <user2_id>`
   - Note the `updated_at` timestamp
   - Wait 9 seconds total from when typing=false was sent
   - In Browser 1 DevTools, check the latest `fetch_new_messages.php` response
   - **Expected:** Response includes `typing_status: { is_typing: false, typing_user_first_name: null }` OR typing_status is not present

3. **Test Only Other User's Status is Returned**
   - In Browser 1, start typing
   - In Browser 2 DevTools, check `fetch_new_messages.php` response
   - **Expected:** Response includes typing status for Browser 1's user (not Browser 2's own status)
   - In Browser 1 DevTools, check `fetch_new_messages.php` response
   - **Expected:** Response does NOT include Browser 1's own typing status (only other user's)

4. **Test SQL Query Uses 8-Second Window**
   - In phpMyAdmin, manually update typing_status:
     ```sql
     UPDATE typing_status 
     SET updated_at = DATE_SUB(NOW(), INTERVAL 9 SECOND)
     WHERE conversation_id = <conv_id> AND user_id = <user2_id>;
     ```
   - In Browser 1, wait for next polling request (~250ms)
   - Check `fetch_new_messages.php` response
   - **Expected:** `typing_status.is_typing = false` (expired status not returned)

5. **Test First Name is Included When Typing**
   - In Browser 2, start typing
   - In Browser 1 DevTools, check `fetch_new_messages.php` response
   - **Expected:** Response includes `typing_user_first_name` with the correct first name from `user_accounts` table

6. **Verify SQL JOIN Works Correctly**
   - In phpMyAdmin, verify the query structure:
     ```sql
     SELECT ts.is_typing, ua.first_name 
     FROM typing_status ts
     INNER JOIN user_accounts ua ON ts.user_id = ua.user_id
     WHERE ts.conversation_id = ? AND ts.user_id = ? 
     AND ts.updated_at > DATE_SUB(NOW(), INTERVAL 8 SECOND)
     ```
   - **Expected:** Query returns correct typing status with first_name when conditions are met

### Expected Outcomes
- Typing status is returned when `updated_at` is within last 8 seconds
- Typing status is NOT returned when `updated_at` is older than 8 seconds
- Only the OTHER user's typing status is returned (not the requesting user's own status)
- First name is correctly joined from `user_accounts` table
- SQL query correctly filters by conversation_id, user_id, and time window

### Fails If
- Typing status is returned after 8+ seconds have passed
- User sees their own typing status in the response
- First name is missing or incorrect
- SQL query doesn't properly filter by the 8-second window

---

## Test 3: Verify Frontend Polling Mechanism Fetches Typing Status Every 250ms

**Type:** Frontend Integration Test  
**Priority:** High  
**Objective:** Verify that the frontend correctly polls fetch_new_messages.php every ~250ms and updates typing status in React state.

### Prerequisites
- Two browser windows logged in as different users
- Both users have access to the same conversation
- Chrome DevTools with Network tab

### Steps

1. **Test Polling Interval is ~250ms**
   - In Browser 1 (testuser@buffalo.edu), open Chrome DevTools → Network tab
   - Filter by `fetch_new_messages.php`
   - Navigate to chat page and open a conversation
   - Wait 2 seconds
   - Count the number of requests to `fetch_new_messages.php` in the last 2 seconds
   - **Expected:** Approximately 8 requests (250ms * 8 = 2000ms), allowing for network variance (±1 request)

2. **Test Polling Stops When Conversation Changes**
   - In Browser 1, note the current conversation_id from URL or network requests
   - Switch to a different conversation (or close conversation)
   - Wait 1 second
   - Check Network tab for new `fetch_new_messages.php` requests
   - **Expected:** No new requests for the old conversation_id, OR requests are for the new conversation_id only

3. **Test Polling Stops When Component Unmounts**
   - In Browser 1, navigate away from chat page (go to home page or another route)
   - Wait 1 second
   - Check Network tab
   - **Expected:** No new `fetch_new_messages.php` requests are made

4. **Test Typing Status Updates in React State**
   - In Browser 2 (testuserschedulered@buffalo.edu), start typing
   - In Browser 1 DevTools → Console, execute:
     ```javascript
     // Monitor React state updates (if React DevTools available)
     // Or check Network responses
     ```
   - In Browser 1 DevTools → Network tab, check multiple `fetch_new_messages.php` responses
   - Verify responses include `typing_status: { is_typing: true, typing_user_first_name: '<name>' }`
   - In Browser 1 UI, verify typing indicator appears showing "<name> is typing..."
   - **Expected:** Typing indicator appears in UI within ~500ms of other user starting to type

5. **Test Polling Resumes When Conversation Reopened**
   - In Browser 1, navigate away from chat, then return to the same conversation
   - Wait 1 second
   - Check Network tab
   - **Expected:** Polling resumes with requests every ~250ms

6. **Test AbortController Cancels Stale Requests**
   - In Browser 1, quickly switch between conversations multiple times
   - In Network tab, check for canceled requests
   - **Expected:** Some requests show "(canceled)" status, proving AbortController is working

### Expected Outcomes
- `fetch_new_messages.php` is polled approximately every 250ms when conversation is active
- Polling stops when conversation changes or component unmounts
- Typing status from API responses correctly updates React state
- Typing indicator appears in UI when other user is typing
- Stale requests are canceled when conversation changes

### Fails If
- Polling interval is significantly different from 250ms (>300ms or <200ms consistently)
- Polling continues after navigating away from chat page
- Typing indicator doesn't appear despite API returning typing status
- Multiple polling intervals run simultaneously for same conversation

---

## Test 4: Verify Typing Status Timeout Scenarios

**Type:** Frontend + Backend Integration Test  
**Priority:** High  
**Objective:** Verify that typing status correctly times out after 30 seconds of continuous typing (frontend) and 8 seconds after last update (backend).

### Prerequisites
- Two browser windows logged in as different users
- Both users have access to the same conversation
- Chrome DevTools with Network tab
- Stopwatch or timer

### Steps

1. **Test 30-Second Continuous Typing Timeout (Frontend)**
   - In Browser 2 (testuserschedulered@buffalo.edu), open Chrome DevTools → Network tab
   - Start a stopwatch
   - Begin typing continuously (type "q" repeatedly to keep input active)
   - Monitor POST requests to `typing_status.php` in Network tab
   - Continue typing for 35 seconds total
   - **Expected:** 
     - POST requests with `is_typing: true` are sent initially
     - After ~30 seconds, POST requests with `is_typing: true` STOP being sent (frontend timeout)
     - Typing indicator disappears on Browser 1 after ~30 seconds

2. **Test 8-Second Backend Expiration**
   - In Browser 2, type briefly (1-2 seconds), then stop
   - Wait 3 seconds (for typing=false to be sent)
   - In Browser 1 DevTools → Network tab, monitor `fetch_new_messages.php` responses
   - Wait 9 seconds total from when typing stopped
   - Check latest `fetch_new_messages.php` response
   - **Expected:** Response includes `typing_status: { is_typing: false }` or typing_status is absent (expired)

3. **Test 3-Second Delay Before Sending typing=false**
   - In Browser 2, type a few characters, then immediately stop typing
   - In Browser 2 DevTools → Network tab, monitor POST requests
   - Start stopwatch when you stop typing
   - **Expected:** 
     - POST request with `is_typing: false` is sent approximately 3 seconds after stopping
     - No immediate `is_typing: false` request (proves 3-second delay exists)

4. **Test Typing Indicator Disappears After Backend Expiration**
   - In Browser 2, type briefly, then stop
   - In Browser 1, verify typing indicator appears
   - Wait 9 seconds total
   - In Browser 1, verify typing indicator has disappeared
   - **Expected:** Typing indicator disappears even if frontend hasn't received typing=false (backend expiration)

5. **Test Frontend Timeout Prevents Further typing=true Updates**
   - In Browser 2, type continuously for 31 seconds
   - After 30 seconds, verify no more POST requests with `is_typing: true` are sent
   - Continue typing for another 5 seconds
   - **Expected:** Still no POST requests with `is_typing: true` (frontend timeout is enforced)

### Expected Outcomes
- Frontend stops sending `typing=true` after 30 seconds of continuous typing
- Backend expires typing status after 8 seconds of inactivity
- Frontend waits 3 seconds before sending `typing=false` after user stops typing
- Typing indicator disappears on receiving user's screen after appropriate timeout
- Both frontend and backend timeouts work independently and correctly

### Fails If
- Typing indicator stays visible after 30+ seconds of continuous typing
- Typing status is returned by backend after 8+ seconds of inactivity
- `typing=false` is sent immediately (no 3-second delay)
- Frontend continues sending `typing=true` after 30 seconds

---

## Test 5: Verify Database typing_status Table Structure and Constraints

**Type:** Database Test  
**Priority:** Medium  
**Objective:** Verify that the typing_status table has correct structure, constraints, and indexes.

### Prerequisites
- Access to phpMyAdmin
- Database: `cse442_2025_fall_team_j_db`

### Steps

1. **Verify Table Exists**
   - In phpMyAdmin, navigate to database `cse442_2025_fall_team_j_db`
   - Locate table `typing_status`
   - **Expected:** Table exists

2. **Verify Required Columns Exist**
   - Click on `typing_status` table → Structure tab
   - Verify columns exist:
     - `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
     - `conversation_id` (INT, NOT NULL)
     - `user_id` (INT, NOT NULL)
     - `is_typing` (TINYINT or BOOLEAN, NOT NULL, default 0)
     - `updated_at` (TIMESTAMP or DATETIME, NOT NULL)
   - **Expected:** All columns exist with correct data types

3. **Verify Primary Key and Unique Constraint**
   - Check table structure for PRIMARY KEY on `id`
   - Check for UNIQUE constraint on (`conversation_id`, `user_id`)
   - **Expected:** 
     - PRIMARY KEY exists on `id`
     - UNIQUE constraint exists on (`conversation_id`, `user_id`) OR composite primary key

4. **Verify Foreign Key Constraints**
   - Check table structure → Relation view
   - Verify foreign keys:
     - `conversation_id` → `conversations.conv_id`
     - `user_id` -> `user_accounts.user_id`
   - **Expected:** Foreign key constraints exist (or verify referential integrity manually)

5. **Test INSERT with ON DUPLICATE KEY UPDATE**
   - In phpMyAdmin → SQL tab, execute:
     ```sql
     INSERT INTO typing_status (conversation_id, user_id, is_typing, updated_at) 
     VALUES (1, 2, 1, NOW())
     ON DUPLICATE KEY UPDATE is_typing = 1, updated_at = NOW();
     ```
   - Execute same INSERT again with `is_typing = 0`
   - Query: `SELECT * FROM typing_status WHERE conversation_id = 1 AND user_id = 2`
   - **Expected:** Only 1 row exists, with `is_typing = 0` (proves UPDATE worked, not INSERT)

6. **Test updated_at Timestamp Updates**
   - Note current `updated_at` for a test row
   - Wait 2 seconds
   - Update the row: `UPDATE typing_status SET is_typing = 1 WHERE conversation_id = <id> AND user_id = <id>`
   - Query the row again
   - **Expected:** `updated_at` timestamp is updated (if using ON UPDATE CURRENT_TIMESTAMP) OR matches the UPDATE time

7. **Verify Indexes for Performance**
   - Check table structure → Indexes tab
   - Verify indexes exist on:
     - `conversation_id`
     - `user_id`
     - `updated_at` (for time-based queries)
   - **Expected:** Indexes exist for efficient querying

### Expected Outcomes
- Table exists with all required columns
- Primary key and unique constraints prevent duplicate entries
- Foreign key constraints maintain referential integrity
- ON DUPLICATE KEY UPDATE works correctly
- `updated_at` timestamp updates correctly
- Indexes exist for query performance

### Fails If
- Table or columns are missing
- No unique constraint on (conversation_id, user_id)
- Foreign key constraints are missing or incorrect
- ON DUPLICATE KEY UPDATE doesn't work (creates duplicates)
- `updated_at` doesn't update automatically

---

## Test 6: Verify Error Handling and Edge Cases

**Type:** Error Handling Test  
**Priority:** Medium  
**Objective:** Verify that the typing indicator feature handles errors gracefully and prevents unauthorized access.

### Prerequisites
- Two browser windows logged in as different users
- Chrome DevTools
- Access to phpMyAdmin

### Steps

1. **Test Unauthorized Access (No Session)**
   - Open a new incognito window (no login)
   - In DevTools Console, execute:
     ```javascript
     fetch('/api/chat/typing_status.php', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ conversation_id: 1, is_typing: true })
     }).then(r => r.json()).then(console.log)
     ```
   - **Expected:** Response has `success: false` and `error: 'Not authenticated'` with HTTP 401 status

2. **Test Invalid conversation_id**
   - In Browser 1 (logged in), DevTools Console:
     ```javascript
     fetch('/api/chat/typing_status.php', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({ conversation_id: 0, is_typing: true })
     }).then(r => r.json()).then(console.log)
     ```
   - **Expected:** Response has `success: false` and `error: 'conversation_id is required'` with HTTP 400 status

3. **Test User Not in Conversation (Access Denied)**
   - In Browser 1, find a conversation_id that Browser 1 does NOT belong to
   - In Browser 1 DevTools Console:
     ```javascript
     fetch('/api/chat/typing_status.php', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: JSON.stringify({ conversation_id: <unauthorized_conv_id>, is_typing: true })
     }).then(r => r.json()).then(console.log)
     ```
   - **Expected:** Response has `success: false` and `error: 'Access denied'` with HTTP 403 status

4. **Test Invalid JSON in Request Body**
   - In Browser 1 DevTools Console:
     ```javascript
     fetch('/api/chat/typing_status.php', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
       body: 'invalid json{'
     }).then(r => r.json()).then(console.log)
     ```
   - **Expected:** Response has `success: false` and `error: 'Invalid JSON'` with HTTP 400 status

5. **Test Network Failure Handling**
   - In Browser 2, start typing
   - In Browser 2 DevTools → Network tab → Throttling, set to "Offline"
   - Try typing again
   - **Expected:** No error is thrown in console (fail silently), typing indicator gracefully degrades

6. **Test Request Cancellation (AbortController)**
   - In Browser 2, start typing
   - Quickly switch conversations multiple times
   - In Network tab, verify some requests show "(canceled)"
   - **Expected:** Canceled requests don't cause errors, new requests proceed normally

7. **Test GET Endpoint with Invalid conversation_id**
   - In Browser 1 DevTools Console:
     ```javascript
     fetch('/api/chat/fetch_new_messages.php?conv_id=0&ts=0', {
       credentials: 'include'
     }).then(r => r.json()).then(console.log)
     ```
   - **Expected:** Response handles invalid conversation_id gracefully (may return empty messages or error)

8. **Test Database Connection Failure**
   - This test requires simulating database failure (may need backend access)
   - **Expected:** API returns appropriate error response, doesn't crash

### Expected Outcomes
- Unauthorized users cannot update typing status
- Invalid conversation_id returns appropriate error
- Users cannot update typing status for conversations they don't belong to
- Invalid JSON is handled gracefully
- Network failures don't crash the application
- Request cancellation works without errors
- All error cases return appropriate HTTP status codes

### Fails If
- Unauthorized users can update typing status
- Invalid input causes application crashes
- Error messages expose sensitive information
- Network failures cause unhandled exceptions
- Error responses don't include proper HTTP status codes

---

## Test 7: Verify Race Condition Prevention

**Type:** Concurrency Test  
**Priority:** Medium  
**Objective:** Verify that request sequencing and AbortController prevent race conditions when typing status updates occur rapidly.

### Prerequisites
- Two browser windows logged in as different users
- Both users have access to the same conversation
- Chrome DevTools with Network tab

### Steps

1. **Test Request Sequencing Prevents Stale Responses**
   - In Browser 2, type very rapidly (multiple characters quickly)
   - In Browser 2 DevTools → Network tab, monitor POST requests to `typing_status.php`
   - Note the sequence of requests and their timestamps
   - **Expected:** 
     - Multiple requests are made
     - Requests complete in order (or are canceled if stale)
     - No duplicate `typing=true` requests after `typing=false` has been sent

2. **Test AbortController Cancels Stale Requests**
   - In Browser 2, start typing
   - Immediately switch to a different conversation
   - In Network tab, check for canceled requests
   - **Expected:** Previous typing status requests show "(canceled)" status

3. **Test Concurrent Typing Status Updates from Same User**
   - In Browser 2, rapidly type and stop multiple times
   - In Network tab, monitor all POST requests
   - Verify request sequence numbers (if visible in network logs)
   - **Expected:** 
     - Only the latest request's response is processed
     - Stale responses are ignored (sequence number check)

4. **Test Typing Status Doesn't Get Stuck**
   - In Browser 2, type briefly, then stop
   - Wait for `typing=false` to be sent
   - In Browser 1, verify typing indicator disappears
   - In Browser 2, type again quickly
   - **Expected:** Typing indicator appears again (no stuck state)

5. **Test Multiple Rapid Conversation Switches**
   - In Browser 1, rapidly switch between 3+ conversations
   - In Network tab, verify requests are made for correct conversation_id
   - **Expected:** 
     - Only requests for the currently active conversation proceed
     - Previous conversation's requests are canceled
     - No race conditions where wrong conversation's typing status is displayed

6. **Test Typing Status During Message Send**
   - In Browser 2, start typing
   - Immediately send a message (click send button)
   - In Network tab, verify sequence:
     - POST to `typing_status.php` with `is_typing: false` is sent
     - POST to `create_message.php` is sent
   - **Expected:** 
     - `typing=false` is sent before or with message send
     - Typing indicator disappears when message is sent
     - No race condition where typing indicator stays visible after message sent

### Expected Outcomes
- Request sequencing prevents stale responses from being processed
- AbortController correctly cancels stale requests
- Rapid typing doesn't cause race conditions
- Typing status doesn't get stuck in incorrect state
- Conversation switches correctly cancel previous requests
- Message sending correctly clears typing status

### Fails If
- Stale responses cause incorrect typing indicator display
- Multiple concurrent requests cause race conditions
- Typing indicator gets stuck showing "typing" when user stopped
- Wrong conversation's typing status is displayed
- Typing indicator remains visible after message is sent

---

## Summary

These test cases verify the typing indicator feature at multiple levels:

- **Backend API Tests (Tests 1-2):** Verify database operations and API endpoint functionality
- **Frontend Integration Tests (Tests 3-4):** Verify polling mechanism and timeout handling
- **Database Tests (Test 5):** Verify table structure and constraints
- **Error Handling Tests (Test 6):** Verify graceful error handling and security
- **Concurrency Tests (Test 7):** Verify race condition prevention

All tests focus on verifying actual code functionality rather than just UI behavior, ensuring the typing indicator works correctly, securely, and reliably.


