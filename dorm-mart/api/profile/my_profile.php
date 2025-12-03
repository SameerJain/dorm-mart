<?php
declare(strict_types=1);

/**
 * GET /api/profile/my_profile.php
 * Returns the authenticated user's profile details along with seller review metadata.
 */

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/profile_helpers.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $userId = require_login();
    $conn = db();
    $conn->set_charset('utf8mb4');

    $profileRow = fetch_profile_row($conn, $userId);
    if (!$profileRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Profile not found']);
        exit;
    }

    $ratingStats = fetch_rating_stats($conn, $userId);
    $reviews     = fetch_reviews($conn, $userId);

    $fullName = trim(trim((string)$profileRow['first_name']) . ' ' . trim((string)$profileRow['last_name']));
    $email    = (string)($profileRow['email'] ?? '');
    $username = derive_username($email);

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    $response = [
        'success'     => true,
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

    $conn->close();
    echo json_encode($response);
} catch (Throwable $e) {
    error_log('my_profile.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
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
        $buyerName = trim(trim((string)$row['buyer_first']) . ' ' . trim((string)$row['buyer_last']));
        if ($buyerName === '') {
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

