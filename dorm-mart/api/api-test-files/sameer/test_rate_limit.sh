#!/bin/bash

# Rate Limiting Test Script
# Tests that 5 failed login attempts trigger a 5-minute lockout
# and that attempt 6+ are blocked with 429 status

echo "=== Rate Limiting Test ==="

# Clean up any previous cookies
rm -f cookies.txt

# Attempt 1: Initial login attempt to get a session cookie
echo -e "\nAttempt 1"
curl -X POST "http://localhost:8080/api/auth/login.php" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@buffalo.edu","password":"wrongpassword"}' \
  -c cookies.txt \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

# Attempts 2-6 using the same session cookie
for i in {2..6}; do 
  echo -e "\nAttempt $i"
  curl -X POST "http://localhost:8080/api/auth/login.php" \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -c cookies.txt \
    -d '{"email":"test@buffalo.edu","password":"wrongpassword"}' \
    -w "\nHTTP Status: %{http_code}\n" \
    -s
  sleep 1 # Small delay to simulate user input
done

echo -e "\n=== Test Complete ==="
echo "Expected: Attempts 1-4 return 401, Attempt 5+ return 429"
echo "Cleaning up..."
rm -f cookies.txt
echo "Done!"

