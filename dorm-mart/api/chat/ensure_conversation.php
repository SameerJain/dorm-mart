<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$buyerId = $result['userId'];
$conn = $result['conn'];

try {
    $conn->set_charset('utf8mb4');
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $productId = isset($payload['product_id']) ? (int)$payload['product_id'] : 0;
    $sellerId = isset($payload['seller_user_id']) ? (int)$payload['seller_user_id'] : 0;

    if ($productId <= 0 && $sellerId <= 0) {
        send_json_error(400, 'Missing product_id or seller_user_id');
    }

    $productRow = null;

    if ($productId > 0) {
        $stmt = $conn->prepare('SELECT product_id, seller_id, title, photos FROM INVENTORY WHERE product_id = ? LIMIT 1');
        if (!$stmt) {
            send_json_error(500, 'Database error');
        }
        $stmt->bind_param('i', $productId);
        if (!$stmt->execute()) {
            $stmt->close();
            send_json_error(500, 'Database error');
        }
        $res = $stmt->get_result();
        $productRow = $res ? $res->fetch_assoc() : null;
        $stmt->close();

        if (!$productRow || empty($productRow['seller_id'])) {
            send_json_error(404, 'Product not found');
        }

        $sellerId = (int)$productRow['seller_id'];
    }

    if ($sellerId <= 0) {
        send_json_error(400, 'Seller not found');
    }

    if ($sellerId === $buyerId) {
        send_json_error(400, 'Cannot message your own listing');
    }

    $orderedA = min($buyerId, $sellerId);
    $orderedB = max($buyerId, $sellerId);
    $lockKey = sprintf('conv:%d:%d', $orderedA, $orderedB);
    $conversationRow = null;

    try {
        $conn->begin_transaction();

        $stmt = $conn->prepare('SELECT GET_LOCK(?, 5) AS locked');
        if (!$stmt) {
            throw new RuntimeException('Failed to prepare lock query');
        }
        $stmt->bind_param('s', $lockKey);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Failed to acquire lock');
        }
        $lockRes = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$lockRes || (int)$lockRes['locked'] !== 1) {
            throw new RuntimeException('Could not obtain lock');
        }

        if ($productId > 0) {
            $stmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname, product_id FROM conversations WHERE user1_id = ? AND user2_id = ? AND product_id = ? LIMIT 1');
            if (!$stmt) {
                throw new RuntimeException('Failed to prepare conversation lookup');
            }
            $stmt->bind_param('iii', $orderedA, $orderedB, $productId);
        } else {
            $stmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_fname, user2_fname, product_id FROM conversations WHERE user1_id = ? AND user2_id = ? AND product_id IS NULL LIMIT 1');
            if (!$stmt) {
                throw new RuntimeException('Failed to prepare conversation lookup');
            }
            $stmt->bind_param('ii', $orderedA, $orderedB);
        }
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('Failed to execute conversation lookup');
        }
        $result = $stmt->get_result();
        $conversationRow = $result ? $result->fetch_assoc() : null;
        $stmt->close();

        if ($conversationRow) {
            $convId = (int)$conversationRow['conv_id'];
            $stmt = $conn->prepare('INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count) VALUES (?, ?, 0, 0), (?, ?, 0, 0)');
            if ($stmt) {
                $stmt->bind_param('iiii', $convId, $orderedA, $convId, $orderedB);
                $stmt->execute();
                $stmt->close();
            }
        }

        if (!$conversationRow) {
            $stmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
            if (!$stmt) {
                throw new RuntimeException('Failed to prepare name lookup');
            }
            $stmt->bind_param('ii', $orderedA, $orderedB);
            if (!$stmt->execute()) {
                $stmt->close();
                throw new RuntimeException('Failed to execute name lookup');
            }
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

            if ($productId > 0) {
                $stmt = $conn->prepare('INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id) VALUES (?, ?, ?, ?, ?)');
                if (!$stmt) {
                    throw new RuntimeException('Failed to prepare conversation insert');
                }
                $stmt->bind_param('iissi', $orderedA, $orderedB, $user1Name, $user2Name, $productId);
            } else {
                $stmt = $conn->prepare('INSERT INTO conversations (user1_id, user2_id, user1_fname, user2_fname, product_id) VALUES (?, ?, ?, ?, NULL)');
                if (!$stmt) {
                    throw new RuntimeException('Failed to prepare conversation insert');
                }
                $stmt->bind_param('iiss', $orderedA, $orderedB, $user1Name, $user2Name);
            }
            if (!$stmt->execute()) {
                $stmt->close();
                throw new RuntimeException('Failed to insert conversation');
            }
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

            $stmt = $conn->prepare('INSERT IGNORE INTO conversation_participants (conv_id, user_id, first_unread_msg_id, unread_count) VALUES (?, ?, 0, 0), (?, ?, 0, 0)');
            if ($stmt) {
                $stmt->bind_param('iiii', $convId, $orderedA, $convId, $orderedB);
                $stmt->execute();
                $stmt->close();
            }
        }

        $stmt = $conn->prepare('SELECT RELEASE_LOCK(?)');
        if ($stmt) {
            $stmt->bind_param('s', $lockKey);
            $stmt->execute();
            $stmt->close();
        }

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
            require_once __DIR__ . '/../utility/env_config.php';
            $publicBase = (get_env_var('PUBLIC_URL') ?: '');
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
        if ($namesStmt->execute()) {
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
        }
        $namesStmt->close();
    }

    $convId = (int)$conversationRow['conv_id'];
    $existingMessageCount = 0;
    $countStmt = $conn->prepare('SELECT COUNT(*) AS cnt FROM messages WHERE conv_id = ? LIMIT 1');
    if ($countStmt) {
        $countStmt->bind_param('i', $convId);
        if ($countStmt->execute()) {
            $cntRes = $countStmt->get_result();
            $cntRow = $cntRes ? $cntRes->fetch_assoc() : null;
            if ($cntRow) {
                $existingMessageCount = (int)$cntRow['cnt'];
            }
        }
        $countStmt->close();
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
            if ($autoMsgStmt->execute()) {
                $autoMsgId = $autoMsgStmt->insert_id;
            } else {
                $autoMsgStmt->close();
                throw new RuntimeException('Failed to insert auto message');
            }
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

    send_json_success([
        'conv_id' => $convId,
        'product_id' => $productId,
        'seller_id' => $sellerId,
        'buyer_id' => $buyerId,
        'is_new_conversation' => !isset($conversationRow) || empty($conversationRow),
        'conversation' => $conversationRow,
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
    send_json_error(500, 'Internal server error');
}


