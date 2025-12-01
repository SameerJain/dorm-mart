<?php

declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

setSecurityHeaders();
setSecureCORS();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

try {
    $buyerId = require_login();

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;
    $sellerId = isset($payload['seller_user_id']) ? (int)$payload['seller_user_id'] : 0;

    if ($productId <= 0 && $sellerId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing product_id or seller_user_id']);
        exit;
    }

    $conn = db();
    $conn->set_charset('utf8mb4');

    $productRow = null;

    if ($productId > 0) {
        $stmt = $conn->prepare('SELECT product_id, seller_id, title, photos FROM INVENTORY WHERE product_id = ? LIMIT 1');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare product lookup');
        }
        $stmt->bind_param('i', $productId);
        $stmt->execute();
        $res = $stmt->get_result();
        $productRow = $res ? $res->fetch_assoc() : null;
        $stmt->close();

        if (!$productRow || empty($productRow['seller_id'])) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Product not found']);
            exit;
        }

        $sellerId = (int)$productRow['seller_id'];
    }

    if ($sellerId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Seller not found']);
        exit;
    }

    if ($sellerId === $buyerId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Cannot message your own listing']);
        exit;
    }

    $orderedA = min($buyerId, $sellerId);
    $orderedB = max($buyerId, $sellerId);
    $lockKey = sprintf('conv:%d:%d', $orderedA, $orderedB);
    $conversationRow = null;

    try {
        $conn->begin_transaction();

        $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS locked');
        $stmt->bind_param('s', $lockKey);
        $stmt->execute();
        $lockRes = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$lockRes || (int)$lockRes['locked'] !== 1) {
            throw new RuntimeException('Could not obtain lock');
        }

        // Fetch existing conversation if present
        // Check for conversation with matching product_id (or NULL if no product)
        if ($productId > 0) {
            $stmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname, product_id FROM conversations WHERE user1_id = ? AND user2_id = ? AND product_id = ? LIMIT 1');
            $stmt->bind_param('iii', $orderedA, $orderedB, $productId);
        } else {
            $stmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname, product_id FROM conversations WHERE user1_id = ? AND user2_id = ? AND product_id IS NULL LIMIT 1');
            $stmt->bind_param('ii', $orderedA, $orderedB);
        }
        $stmt->execute();
        $result = $stmt->get_result();
        $conversationRow = $result ? $result->fetch_assoc() : null;
        $stmt->close();

        if ($conversationRow) {
            // Ensure conversation participants exist even for existing conversations
            $convId = (int)$conversationRow['conv_id'];
            $stmt = $conn->prepare('INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count) VALUES (?, ?, 0, 0), (?, ?, 0, 0)');
            $stmt->bind_param('iiii', $convId, $orderedA, $convId, $orderedB);
            $stmt->execute();
            $stmt->close();
        }

        if (!$conversationRow) {
            // Need names for both participants
            $stmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
            $stmt->bind_param('ii', $orderedA, $orderedB);
            $stmt->execute();
            $namesRes = $stmt->get_result();
            $stmt->close();

            $names = [
                $orderedA => 'User ' . $orderedA,
                $orderedB => 'User ' . $orderedB,
            ];

            while ($row = $namesRes->fetch_assoc()) {
                $id = (int)$row['user_id'];
                $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
                if ($full !== '') {
                    $names[$id] = $full;
                }
            }

            $user1Name = $names[$orderedA] ?? ('User ' . $orderedA);
            $user2Name = $names[$orderedB] ?? ('User ' . $orderedB);

            // Insert conversation with product_id if provided
            if ($productId > 0) {
                $stmt = $conn->prepare('INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id) VALUES (?, ?, ?, ?, ?)');
                $stmt->bind_param('iissi', $orderedA, $orderedB, $user1Name, $user2Name, $productId);
            } else {
                $stmt = $conn->prepare('INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id) VALUES (?, ?, ?, ?, NULL)');
                $stmt->bind_param('iiss', $orderedA, $orderedB, $user1Name, $user2Name);
            }
            $stmt->execute();
            $stmt->close();

            $convId = $conn->insert_id;
            $conversationRow = [
                'conv_id' => $convId,
                'user1_id' => $orderedA,
                'user2_id' => $orderedB,
                'user1_fname' => $user1Name,
                'user2_fname' => $user2Name,
                'product_id' => $productId > 0 ? $productId : null,
            ];

            // Ensure conversation participants rows exist for both users
            $stmt = $conn->prepare('INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count) VALUES (?, ?, 0, 0), (?, ?, 0, 0)');
            $stmt->bind_param('iiii', $convId, $orderedA, $convId, $orderedB);
            $stmt->execute();
            $stmt->close();
        }

        // Release lock
        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->bind_param('s', $lockKey);
        $stmt->execute();
        $stmt->close();

        $conn->commit();
    } catch (Throwable $inner) {
        $conn->rollback();
        if (isset($lockKey)) {
            $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
            if ($stmt) {
                $stmt->bind_param('s', $lockKey);
                $stmt->execute();
                $stmt->close();
            }
        }
        throw $inner;
    }

    if (!$conversationRow) {
        throw new RuntimeException('Unable to ensure conversation');
    }

    // Add product details to conversation row for consistency with fetch_conversations.php
    if ($productRow) {
        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $conversationRow['product_title'] = (string)($productRow['title'] ?? '');
        $conversationRow['product_seller_id'] = isset($productRow['seller_id']) ? (int)$productRow['seller_id'] : null;
        
        // Extract first image URL for product_image_url
        $firstImage = null;
        if (!empty($productRow['photos'])) {
            $decoded = json_decode((string)$productRow['photos'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && count($decoded)) {
                $firstImage = $decoded[0];
            }
        }
        $conversationRow['product_image_url'] = $firstImage;
    } else {
        $conversationRow['product_title'] = null;
        $conversationRow['product_seller_id'] = null;
        $conversationRow['product_image_url'] = null;
    }

    $productDetails = null;
    $buyerName = null;
    $buyerFirst = null;
    $buyerLast = null;
    $sellerName = null;
    $sellerFirst = null;
    $sellerLast = null;
    if ($productRow) {
        $firstImage = null;
        if (!empty($productRow['photos'])) {
            $decoded = json_decode((string)$productRow['photos'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && count($decoded)) {
                $firstImage = $decoded[0];
            }
        }

        if ($firstImage) {
            $publicBase = (getenv('PUBLIC_URL') ?: '');
            $publicBase = rtrim($publicBase, '/');
            if ($firstImage && is_string($firstImage) && strpos($firstImage, 'http') !== 0) {
                if ($firstImage !== '' && $firstImage[0] !== '/') {
                    $firstImage = '/' . $firstImage;
                }
                $firstImage = $publicBase . $firstImage;
            }
        }

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $productDetails = [
            'product_id' => (int)$productRow['product_id'],
            'title' => (string)($productRow['title'] ?? ''),
            'image_url' => $firstImage,
        ];
    }

    $namesStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?) LIMIT 2');
    if ($namesStmt) {
        $namesStmt->bind_param('ii', $buyerId, $sellerId);
        $namesStmt->execute();
        $namesRes = $namesStmt->get_result();
        while ($row = $namesRes->fetch_assoc()) {
            $id = (int)$row['user_id'];
            $first = trim((string)($row['first_name'] ?? ''));
            $last = trim((string)($row['last_name'] ?? ''));
            $full = trim($first . ' ' . $last);
            if ($id === $buyerId) {
                $buyerFirst = $first;
                $buyerLast = $last;
                $buyerName = $full !== '' ? $full : null;
            }
            if ($id === $sellerId) {
                $sellerFirst = $first;
                $sellerLast = $last;
                $sellerName = $full !== '' ? $full : null;
            }
        }
        $namesStmt->close();
    }

    $convId = (int)$conversationRow['conv_id'];
    $existingMessageCount = 0;
    $countStmt = $conn->prepare('SELECT COUNT(*) AS cnt FROM messages WHERE conv_id = ? LIMIT 1');
    if ($countStmt) {
        $countStmt->bind_param('i', $convId);
        $countStmt->execute();
        $cntRes = $countStmt->get_result();
        $cntRow = $cntRes ? $cntRes->fetch_assoc() : null;
        $countStmt->close();
        if ($cntRow) {
            $existingMessageCount = (int)$cntRow['cnt'];
        }
    }

    $autoMessage = null;
    if ($existingMessageCount === 0 && $productDetails && $buyerName) {
        $previewContent = sprintf(
            '%s would like to message you about %s',
            $buyerName,
            $productDetails['title']
        );

        $autoMsgStmt = $conn->prepare(
            'INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        if ($autoMsgStmt) {
            $metadata = json_encode([
                'type' => 'listing_intro',
                'product' => $productDetails,
                'buyer_name' => $buyerName,
            ], JSON_UNESCAPED_SLASHES);

            $senderName = $buyerName;
            if (!$senderName || trim($senderName) === '') {
                $senderName = 'User ' . $buyerId;
            }
            $receiverName = $sellerName ?? ('User ' . $sellerId);

            $autoMsgStmt->bind_param(
                'iiissss',
                $convId,
                $buyerId,
                $sellerId,
                $senderName,
                $receiverName,
                $previewContent,
                $metadata
            );
            $autoMsgStmt->execute();
            $autoMsgId = $autoMsgStmt->insert_id;
            $autoMsgStmt->close();

            $createdIso = gmdate('Y-m-d\TH:i:s\Z');
            // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
            $autoMessage = [
                'message_id' => (int)$autoMsgId,
                'conv_id' => $convId,
                'sender_id' => $buyerId,
                'receiver_id' => $sellerId,
                'content' => $previewContent,
                'metadata' => $metadata,
                'created_at' => $createdIso,
            ];

            $updateStmt = $conn->prepare(
                'UPDATE conversation_participants
                   SET unread_count = unread_count + 1,
                       first_unread_msg_id = CASE
                           WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ?
                           ELSE first_unread_msg_id
                       END
                 WHERE conv_id = ? AND user_id = ?'
            );
            if ($updateStmt) {
                $updateStmt->bind_param('iii', $autoMsgId, $convId, $sellerId);
                $updateStmt->execute();
                $updateStmt->close();
            }
        }
    }

    // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
    echo json_encode([
        'success' => true,
        'conversation' => $conversationRow,
        'buyer_user_id' => $buyerId,
        'seller_user_id' => $sellerId,
        'conv_id' => $convId,
        'product' => $productDetails,
        'buyer_name' => $buyerName ?? '',
        'seller_name' => $sellerName ?? '',
        'buyer_first_name' => $buyerFirst ?? '',
        'buyer_last_name' => $buyerLast ?? '',
        'seller_first_name' => $sellerFirst ?? '',
        'seller_last_name' => $sellerLast ?? '',
        'auto_message' => $autoMessage,
    ]);
} catch (Throwable $e) {
    error_log('ensure_conversation error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}


