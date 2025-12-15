<?php
declare(strict_types=1);

/**
 * GET /api/profile/my_profile.php
 * Returns the authenticated user's profile details along with seller review metadata.
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/profile_helpers.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];
$conn = $result['conn'];

try {
    $profileRow = fetch_profile_row($conn, $userId);
    if (!$profileRow) {
        send_json_error(404, 'Profile not found');
    }

    $ratingStats = fetch_rating_stats($conn, $userId);
    $reviews     = fetch_reviews($conn, $userId);

    $response = format_profile_response($profileRow, $ratingStats, $reviews);
    $conn->close();
    
    send_json_success($response);
} catch (Throwable $e) {
    error_log('my_profile.php error: ' . $e->getMessage());
    send_json_error(500, 'Internal server error');
}

/**
 * Format profile response data
 * 
 * @param array $profileRow Profile row from database
 * @param array $ratingStats Rating statistics
 * @param array $reviews Reviews array
 * @return array Formatted response data
 */
function format_profile_response(array $profileRow, array $ratingStats, array $reviews): array
{
    $fullName = trim(trim((string)$profileRow['first_name']) . ' ' . trim((string)$profileRow['last_name']));
    $email    = (string)($profileRow['email'] ?? '');
    $username = derive_username($email);

    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    return [
        'profile'     => [
            'name'        => $fullName !== '' ? $fullName : null,
            'username'    => $username,
            'email'       => $email,
            'image_url'   => format_profile_photo_url($profileRow['profile_photo'] ?? null),
            'bio'         => $profileRow['bio'] ?? '',
            'instagram'   => $profileRow['instagram'] ?? '',
            'avg_rating'  => $ratingStats['avg_rating'],
            'review_count'=> $ratingStats['review_count'],
        ],
        'reviews'     => $reviews,
    ];
}

/**
 * @return array<string, mixed>|null
 */
function fetch_profile_row(mysqli $conn, int $userId): ?array
{
    $sql = 'SELECT first_name, last_name, email, profile_photo, bio, instagram 
            FROM user_accounts WHERE user_id = ? LIMIT 1';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare profile lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return $row ?: null;
}

/**
 * @return array{avg_rating: float, review_count: int}
 */
function fetch_rating_stats(mysqli $conn, int $userId): array
{
    $sql = 'SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS review_count
            FROM product_reviews WHERE seller_user_id = ?';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare rating stats lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    return [
        'avg_rating'   => isset($row['avg_rating']) ? round((float)$row['avg_rating'], 2) : 0.0,
        'review_count' => isset($row['review_count']) ? (int)$row['review_count'] : 0,
    ];
}

/**
 * @return array<int, array<string, mixed>>
 */
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
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare reviews lookup');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $reviews = [];
    while ($row = $result->fetch_assoc()) {
        // Adapt row structure for build_seller_name helper
        $buyerRow = [
            'first_name' => $row['buyer_first'] ?? '',
            'last_name' => $row['buyer_last'] ?? '',
            'email' => $row['buyer_email'] ?? ''
        ];
        $buyerName = build_seller_name($buyerRow);
        if ($buyerName === 'Unknown Seller') {
            $buyerName = derive_username((string)($row['buyer_email'] ?? '')) ?: 'Buyer #' . (int)$row['buyer_user_id'];
        }

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $reviews[] = [
            'review_id'      => (int)$row['review_id'],
            'product_id'     => (int)$row['product_id'],
            'reviewer_name'  => $buyerName,
            'reviewer_email' => $row['buyer_email'] ?? '',
            'reviewer_username' => derive_username((string)($row['buyer_email'] ?? '')),
            'product_title'  => $row['product_title'] ?? 'Untitled product',
            'review'         => $row['review_text'] ?? '',
            'image_1'        => format_review_image_url($row['image1_url'] ?? null),
            'image_2'        => format_review_image_url($row['image2_url'] ?? null),
            'image_3'        => format_review_image_url($row['image3_url'] ?? null),
            'rating'         => (float)$row['rating'],
            'created_at'     => $row['created_at'],
        ];
    }

    $stmt->close();
    return $reviews;
}

