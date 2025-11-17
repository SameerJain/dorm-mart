# Backend Tests for Seller Review Viewing

## Test 4: Verify get_product_reviews API endpoint returns review data (Happy Path)

Make sure you have completed test 2 from above.

Enter the following bash command in your terminal below: (Note: For windows, we recommend using Git Bash or WSL2)

**Step 1: Login as seller**

```bash
curl -X POST "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/auth/login.php" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -c cookies_seller.txt \
  -d '{"email": "testuserschedulered@buffalo.edu", "password": "1234!"}'
```

**Step 2: Get the product_id of the Rice Cooker**

You can find it from the seller dashboard or use this command to get seller listings:

```bash
curl -X POST "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/seller-dashboard/manage_seller_listings.php" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -b cookies_seller.txt \
  -d '{}'
```

Find the product_id for "Rice Cooker" from the response. Then insert it into the command below at the specified location and run it:

```bash
curl -X GET "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/reviews/get_product_reviews.php?product_id=PRODUCT_ID" \
  -H "Accept: application/json" \
  -b cookies_seller.txt
```

**Expected Outcome:**

```json
{
  "success": true,
  "count": 1,
  "reviews": [
    {
      "review_id": <number>,
      "product_id": <number>,
      "buyer_user_id": <number>,
      "seller_user_id": <number>,
      "rating": 5.0,
      "product_rating": 4.5,
      "review_text": "This rice cooker is so great! Look at what I made.",
      "image1_url": "/media/review-images/rice-cooker-review-image.jpg",
      "image2_url": null,
      "image3_url": null,
      "created_at": "<timestamp>",
      "updated_at": "<timestamp>",
      "buyer_name": "test general-test-user",
      "buyer_email": "testuser@buffalo.edu"
    }
  ]
}
```

**Fails If any of the following are true:**
- Response contains "success": false
- Response contains "count": 0 or empty "reviews" array
- rating is not 5.0
- product_rating is not 4.5
- review_text does not match "This rice cooker is so great! Look at what I made."
- image1_url is null or incorrect
- HTTP status code is not 200

---

## Test 5: Verify get_product_reviews API endpoint returns error for unauthorized access (Alternate Path)

Make sure you have completed test 4 from above.

Test with a user who is not the seller. Enter the following commands:

**Step 1: Login as buyer (not the seller)**

```bash
curl -X POST "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/auth/login.php" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -c cookies_buyer.txt \
  -d '{"email": "testuser@buffalo.edu", "password": "1234!"}'
```

**Step 2: Try to access seller reviews (should fail)**

Use the same product_id from Test 4. Replace PRODUCT_ID in the command below:

```bash
curl -X GET "https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/api/reviews/get_product_reviews.php?product_id=PRODUCT_ID" \
  -H "Accept: application/json" \
  -b cookies_buyer.txt
```

**Expected Outcome:**

```json
{
  "success": false,
  "error": "You are not authorized to view reviews for this product"
}
```

**Fails If:**
- Response contains "success": true
- HTTP status code is not 403
- No error message returned
- Error message does not indicate authorization failure

