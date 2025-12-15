<?php
declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/profile_helpers.php';

// Bootstrap API with GET method (no auth required - public profile)
$result = api_bootstrap('GET', false);
$conn = $result['conn'];

try {
    $usernameParam = trim((string)($_GET['username'] ?? ''));
    if ($usernameParam === '') {
        send_json_error(400, 'Username is required');
    }
    if (strlen($usernameParam) > 64 || containsXSSPattern($usernameParam)) {
        send_json_error(400, 'Invalid username');
    }

    $normalizedUsername = strtolower($usernameParam);

    $userRow = fetch_public_profile_row($conn, $normalizedUsername);
    if (!$userRow) {
        send_json_error(404, 'Profile not found');
    }

    $userId = (int)$userRow['user_id'];
    $ratingStats = fetch_rating_stats($conn, $userId);
    $listings = fetch_active_listings($conn, $userId);
    $reviews = fetch_reviews($conn, $userId);

    $fullName = trim(trim((string)$userRow['first_name']) . ' ' . trim((string)$userRow['last_name']));
    $email = (string)($userRow['email'] ?? '');
    $username = derive_username($email);

    send_json_success([
        'profile' => [
            'user_id' => $userId,
            'name' => $fullName !== '' ? $fullName : null,
            'username' => $username,
            'email' => $email,
            'image_url' => format_profile_photo_url($userRow['profile_photo'] ?? null),
            'bio' => $userRow['bio'] ?? '',
            'instagram' => $userRow['instagram'] ?? '',
            'avg_rating' => $ratingStats['avg_rating'],
            'review_count' => $ratingStats['review_count'],
        ],
        'listings' => $listings,
        'reviews' => $reviews,
    ]);
} catch (Throwable $e) {
    error_log('public_profile.php error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}

function fetch_public_profile_row(mysqli $conn, string $username): ?array
{
    $sql = 'SELECT user_id, first_name, last_name, email, profile_photo, bio, instagram
            FROM user_accounts
            WHERE LOWER(SUBSTRING_INDEX(email, "@", 1)) = ?
            LIMIT 1';
    $stmt = $conn->prepare($sql);
    if (!$stmt || !$stmt->execute()) {
        return null;
    }
    $stmt->bind_param('s', $username);
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    return $row ?: null;
}

function fetch_rating_stats(mysqli $conn, int $userId): array
{
    $sql = 'SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count
            FROM product_reviews
            WHERE seller_user_id = ?';
    $stmt = $conn->prepare($sql);
    if (!$stmt || !$stmt->execute()) {
        return ['avg_rating' => 0.0, 'review_count' => 0];
    }
    $stmt->bind_param('i', $userId);
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    return [
        'avg_rating' => isset($row['avg_rating']) ? round((float)$row['avg_rating'], 2) : 0.0,
        'review_count' => isset($row['review_count']) ? (int)$row['review_count'] : 0,
    ];
}

function fetch_active_listings(mysqli $conn, int $userId): array
{
    $sql = 'SELECT product_id, title, listing_price, item_status, photos, date_listed
            FROM INVENTORY
            WHERE seller_id = ? AND (sold IS NULL OR sold = 0)
            ORDER BY date_listed DESC, product_id DESC
            LIMIT 30';
    $stmt = $conn->prepare($sql);
    if (!$stmt || !$stmt->execute()) {
        return [];
    }
    $stmt->bind_param('i', $userId);
    $result = $stmt->get_result();

    $listings = [];
    while ($row = $result->fetch_assoc()) {
        $photoUrl = extract_first_photo($row['photos'] ?? null);
        $listings[] = [
            'product_id' => (int)$row['product_id'],
            'title' => $row['title'] ?? 'Untitled',
            'price' => isset($row['listing_price']) ? (float)$row['listing_price'] : 0.0,
            'status' => $row['item_status'] ?? 'AVAILABLE',
            'image_url' => $photoUrl,
            'date_listed' => $row['date_listed'] ?? null,
        ];
    }

    $stmt->close();
    return $listings;
}

function extract_first_photo($photos): ?string
{
    $candidates = [];
    if (is_string($photos) && $photos !== '') {
        $decoded = json_decode($photos, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $candidates = $decoded;
        } else {
            $candidates = array_map('trim', explode(',', $photos));
        }
    } elseif (is_array($photos)) {
        $candidates = $photos;
    }

    foreach ($candidates as $photo) {
        if (!is_string($photo)) {
            continue;
        }
        $trimmed = trim($photo);
        if ($trimmed === '') {
            continue;
        }
        return format_profile_photo_url($trimmed);
    }

    return null;
}

function fetch_reviews(mysqli $conn, int $userId): array
{
    $sql = <<<SQL
SELECT 
    pr.review_id,
    pr.product_id,
    pr.buyer_user_id,
    pr.rating,
    pr.review_text,
    pr.image1_url,
    pr.image2_url,
    pr.image3_url,
    pr.created_at,
    inv.title AS product_title,
    buyer.first_name AS buyer_first,
    buyer.last_name AS buyer_last,
    buyer.email AS buyer_email
FROM product_reviews pr
LEFT JOIN INVENTORY inv ON pr.product_id = inv.product_id
LEFT JOIN user_accounts buyer ON pr.buyer_user_id = buyer.user_id
WHERE pr.seller_user_id = ?
ORDER BY pr.created_at DESC
SQL;

    $stmt = $conn->prepare($sql);
    if (!$stmt || !$stmt->execute()) {
        return [];
    }
    $stmt->bind_param('i', $userId);
    $result = $stmt->get_result();

    $reviews = [];
    while ($row = $result->fetch_assoc()) {
        $buyerName = trim(trim((string)$row['buyer_first']) . ' ' . trim((string)$row['buyer_last']));
        if ($buyerName === '') {
            $buyerName = derive_username((string)($row['buyer_email'] ?? '')) ?: 'Buyer #' . (int)$row['buyer_user_id'];
        }

        $reviews[] = [
            'review_id' => (int)$row['review_id'],
            'product_id' => (int)$row['product_id'],
            'reviewer_name' => $buyerName,
            'reviewer_email' => $row['buyer_email'] ?? '',
            'reviewer_username' => derive_username((string)($row['buyer_email'] ?? '')),
            'product_title' => $row['product_title'] ?? 'Untitled product',
            'review' => $row['review_text'] ?? '',
            'image_1' => format_review_image_url($row['image1_url'] ?? null),
            'image_2' => format_review_image_url($row['image2_url'] ?? null),
            'image_3' => format_review_image_url($row['image3_url'] ?? null),
            'rating' => (float)$row['rating'],
            'created_at' => $row['created_at'],
        ];
    }

    $stmt->close();
    return $reviews;
}
