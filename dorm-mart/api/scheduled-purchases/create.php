<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_connect.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$sellerId = $result['userId'];
$conn = $result['conn'];

try {
    $payload = get_request_data();
    if (!is_array($payload)) {
        send_json_error(400, 'Invalid JSON payload');
    }

    $inventoryId = isset($payload['inventory_product_id']) ? (int)$payload['inventory_product_id'] : 0;
    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $meetingAtRaw = isset($payload['meeting_at']) ? trim((string)$payload['meeting_at']) : '';
    $description = isset($payload['description']) ? trim((string)$payload['description']) : '';
    
    if ($description !== '' && containsXSSPattern($description)) {
        send_json_error(400, 'Invalid characters in description');
    }
    
    // New fields for price negotiation and trades
    $negotiatedPrice = isset($payload['negotiated_price']) && $payload['negotiated_price'] !== null 
        ? (float)$payload['negotiated_price'] : null;
    $isTrade = isset($payload['is_trade']) ? (bool)$payload['is_trade'] : false;
    $tradeItemDescription = isset($payload['trade_item_description']) && $payload['trade_item_description'] !== null
        ? trim((string)$payload['trade_item_description']) : null;

    if ($tradeItemDescription !== null && $tradeItemDescription !== '' && containsXSSPattern($tradeItemDescription)) {
        send_json_error(400, 'Invalid characters in trade item description');
    }

    $meetLocationChoice = isset($payload['meet_location_choice'])
        ? trim((string)$payload['meet_location_choice'])
        : null;
    $customMeetLocation = isset($payload['custom_meet_location'])
        ? trim((string)$payload['custom_meet_location'])
        : '';
    $meetLocation = isset($payload['meet_location'])
        ? trim((string)$payload['meet_location'])
        : '';

    if ($customMeetLocation !== '' && containsXSSPattern($customMeetLocation)) {
        send_json_error(400, 'Invalid characters in meet location');
    }

    $allowedMeetLocationChoices = ['', 'North Campus', 'South Campus', 'Ellicott', 'Other'];

    if ($meetLocationChoice !== null) {
        if (!in_array($meetLocationChoice, $allowedMeetLocationChoices, true)) {
            send_json_error(400, 'Invalid meet location choice');
        }

        if ($meetLocationChoice === 'Other') {
            if ($customMeetLocation === '') {
                send_json_error(400, 'Custom meet location is required');
            }
            $meetLocation = $customMeetLocation;
        } elseif ($meetLocationChoice !== '') {
            $meetLocation = $meetLocationChoice;
        }
    }

    if ($inventoryId <= 0 || $conversationId <= 0 || $meetLocation === '' || $meetingAtRaw === '') {
        send_json_error(400, 'Missing required fields');
    }

    if (strlen($meetLocation) > 30) {
        send_json_error(400, 'Meet location is too long');
    }

    $meetingAt = date_create($meetingAtRaw);
    if ($meetingAt === false) {
        send_json_error(400, 'Invalid meeting date/time');
    }
    
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $threeMonthsFromNow = clone $now;
    $threeMonthsFromNow->modify('+3 months');
    
    if ($meetingAt > $threeMonthsFromNow) {
        send_json_error(400, 'Meeting date cannot be more than 3 months in advance');
    }
    
    if ($meetingAt < $now) {
        send_json_error(400, 'Meeting date cannot be in the past');
    }
    
    $meetingAt->setTimezone(new DateTimeZone('UTC'));
    $meetingAtDb = $meetingAt->format('Y-m-d H:i:s');

    $conn->set_charset('utf8mb4');

    $itemStmt = $conn->prepare('SELECT product_id, title, seller_id, price_nego, trades, item_location, listing_price FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$itemStmt) {
        send_json_error(500, 'Database error');
    }
    $itemStmt->bind_param('i', $inventoryId);
    if (!$itemStmt->execute()) {
        $itemStmt->close();
        send_json_error(500, 'Database error');
    }
    $itemRes = $itemStmt->get_result();
    $itemRow = $itemRes ? $itemRes->fetch_assoc() : null;
    $itemStmt->close();

    if (!$itemRow || (int)$itemRow['seller_id'] !== $sellerId) {
        send_json_error(403, 'You can only schedule for your own listings');
    }

    // Snapshot mechanism: Capture item settings at scheduling time
    // This ensures that if seller changes item settings (price negotiable, trades, location) 
    // after scheduling, the scheduled purchase still uses the original settings when accepted
    $snapshotPriceNego = isset($itemRow['price_nego']) ? ((int)$itemRow['price_nego'] === 1) : false;
    $snapshotTrades = isset($itemRow['trades']) ? ((int)$itemRow['trades'] === 1) : false;
    $snapshotMeetLocation = isset($itemRow['item_location']) ? trim((string)$itemRow['item_location']) : null;

    $convStmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$convStmt) {
        send_json_error(500, 'Database error');
    }
    $convStmt->bind_param('i', $conversationId);
    if (!$convStmt->execute()) {
        $convStmt->close();
        send_json_error(500, 'Database error');
    }
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        send_json_error(404, 'Conversation not found');
    }

    $buyerId = 0;
    if ((int)$convRow['user1_id'] === $sellerId) {
        if ((int)$convRow['user1_deleted'] === 1) {
            send_json_error(403, 'Conversation is no longer available');
        }
        $buyerId = (int)$convRow['user2_id'];
    } elseif ((int)$convRow['user2_id'] === $sellerId) {
        if ((int)$convRow['user2_deleted'] === 1) {
            send_json_error(403, 'Conversation is no longer available');
        }
        $buyerId = (int)$convRow['user1_id'];
    } else {
        send_json_error(403, 'You do not have access to this conversation');
    }

    if ($buyerId <= 0) {
        send_json_error(400, 'Could not determine buyer');
    }

    if ($buyerId === $sellerId) {
        send_json_error(400, 'Cannot schedule with yourself');
    }

    // Generate unique 4-character verification code for buyer-seller meetup confirmation
    $verificationCode = generateUniqueCode($conn);

    if ($negotiatedPrice !== null && !$snapshotPriceNego) {
        send_json_error(400, 'This item is not marked as price negotiable');
    }

    if ($isTrade && !$snapshotTrades) {
        send_json_error(400, 'This item does not accept trades');
    }

    if ($isTrade && $negotiatedPrice !== null) {
        send_json_error(400, 'Cannot enter a price for a trade');
    }

    if ($isTrade && ($tradeItemDescription === null || $tradeItemDescription === '')) {
        send_json_error(400, 'Trade item description is required when trade is selected');
    }

    if ($negotiatedPrice !== null) {
        if ($negotiatedPrice < 0 || !is_finite($negotiatedPrice)) {
            send_json_error(400, 'Invalid negotiated price');
        }
        if ($negotiatedPrice > 9999.99) {
            send_json_error(400, 'Negotiated price must be $9999.99 or less');
        }
    }

    $stmt = $conn->prepare('INSERT INTO scheduled_purchase_requests (inventory_product_id, seller_user_id, buyer_user_id, conversation_id, meet_location, meeting_at, verification_code, description, negotiated_price, is_trade, trade_item_description, snapshot_price_nego, snapshot_trades, snapshot_meet_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    if (!$stmt) {
        send_json_error(500, 'Database error');
    }
    
    // Prepare variables for binding - ensure proper NULL handling
    // For nullable integers, use null if value is invalid
    $convId = $conversationId > 0 ? $conversationId : null;
    
    // For nullable strings, convert empty strings to null
    $desc = ($description !== null && $description !== '') ? $description : null;
    $tradeDesc = ($tradeItemDescription !== null && $tradeItemDescription !== '') ? $tradeItemDescription : null;
    $snapLoc = ($snapshotMeetLocation !== null && $snapshotMeetLocation !== '') ? $snapshotMeetLocation : null;
    
    // For nullable decimal, ensure null is passed correctly
    // Allow 0 as a valid price (free item), but convert null/negative to null
    $price = ($negotiatedPrice !== null && $negotiatedPrice >= 0 && is_finite($negotiatedPrice)) ? $negotiatedPrice : null;
    
    // Boolean fields as integers
    $isTradeInt = $isTrade ? 1 : 0;
    $snapshotPriceNegoInt = $snapshotPriceNego ? 1 : 0;
    $snapshotTradesInt = $snapshotTrades ? 1 : 0;
    
    // mysqli bind_param handles NULL correctly, but we need to ensure variables are actually NULL
    // For nullable integer (conversation_id), we pass null directly
    // For nullable strings, mysqli will handle NULL correctly
    // For nullable decimal, mysqli will handle NULL correctly
    $stmt->bind_param('iiiissssdisiis',
        $inventoryId,
        $sellerId,
        $buyerId,
        $convId,
        $meetLocation,
        $meetingAtDb,
        $verificationCode,
        $desc,
        $price,
        $isTradeInt,
        $tradeDesc,
        $snapshotPriceNegoInt,
        $snapshotTradesInt,
        $snapLoc
    );
    
    if (!$stmt->execute()) {
        $error = $stmt->error;
        $stmt->close();
        error_log('Failed to execute scheduled purchase insert: ' . $error);
        throw new RuntimeException('Failed to create scheduled purchase: ' . $error);
    }
    $requestId = $stmt->insert_id;
    $stmt->close();
    
    // Create special message in chat
    if ($conversationId > 0) {
        $sellerStmt = $conn->prepare('SELECT first_name, last_name FROM user_accounts WHERE user_id = ? LIMIT 1');
        if ($sellerStmt) {
            $sellerStmt->bind_param('i', $sellerId);
            if ($sellerStmt->execute()) {
                $sellerRes = $sellerStmt->get_result();
                $sellerRow = $sellerRes ? $sellerRes->fetch_assoc() : null;
            }
            $sellerStmt->close();
        }
        
        $sellerFirstName = $sellerRow ? trim((string)$sellerRow['first_name']) : '';
        $sellerLastName = $sellerRow ? trim((string)$sellerRow['last_name']) : '';
        $sellerDisplayName = '';
        if ($sellerFirstName !== '' && $sellerLastName !== '') {
            $sellerDisplayName = $sellerFirstName . ' ' . $sellerLastName;
        } else {
            $sellerDisplayName = 'User ' . $sellerId;
        }
        
        $messageContent = $sellerDisplayName . ' has scheduled a purchase. Please Accept or Deny.';
        
        // Use conversation details from earlier query to determine sender/receiver
        $msgSenderId = $sellerId;
        $msgReceiverId = $buyerId;
        
        $nameStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
        if ($nameStmt) {
            $nameStmt->bind_param('ii', $msgSenderId, $msgReceiverId);
            if ($nameStmt->execute()) {
                $nameRes = $nameStmt->get_result();
                $names = [];
                while ($row = $nameRes->fetch_assoc()) {
                    $id = (int)$row['user_id'];
                    $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
                    $names[$id] = $full !== '' ? $full : ('User ' . $id);
                }
            }
            $nameStmt->close();
        }
        
        $senderName = $names[$msgSenderId] ?? ('User ' . $msgSenderId);
        $receiverName = $names[$msgReceiverId] ?? ('User ' . $msgReceiverId);
        
        // Get listing price for display
        $listingPrice = isset($itemRow['listing_price']) ? (float)$itemRow['listing_price'] : null;
        
        $metadata = json_encode([
            'type' => 'schedule_request',
            'request_id' => $requestId,
            'inventory_product_id' => $inventoryId,
            'product_id' => $inventoryId,
            'product_title' => $itemRow['title'] ?? '',
            'meeting_at' => $meetingAt->format(DateTime::ATOM),
            'meet_location' => $meetLocation,
            'original_meet_location' => $snapshotMeetLocation,
            'verification_code' => $verificationCode,
            'description' => $description,
            'negotiated_price' => $negotiatedPrice,
            'listing_price' => $listingPrice,
            'is_trade' => $isTrade,
            'trade_item_description' => $tradeItemDescription,
        ], JSON_UNESCAPED_SLASHES);
        
        $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
        if ($msgStmt) {
            $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $senderName, $receiverName, $messageContent, $metadata);
            if ($msgStmt->execute()) {
                $msgId = $msgStmt->insert_id;
                
                $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
                if ($updateStmt) {
                    $updateStmt->bind_param('iii', $msgId, $conversationId, $msgReceiverId);
                    $updateStmt->execute();
                    $updateStmt->close();
                }
            }
            $msgStmt->close();
        }
    }

    send_json_success([
        'request_id' => $requestId,
        'inventory_product_id' => $inventoryId,
        'conversation_id' => $conversationId,
        'seller_user_id' => $sellerId,
        'buyer_user_id' => $buyerId,
        'meet_location' => $meetLocation,
        'meeting_at' => $meetingAt->format(DateTime::ATOM),
        'verification_code' => $verificationCode,
        'status' => 'pending',
    ]);
} catch (Throwable $e) {
    error_log('scheduled-purchase create error: ' . $e->getMessage());
    send_json_error(500, 'Server error');
}

function generateUniqueCode(mysqli $conn): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $length = strlen($alphabet) - 1;

    $checkStmt = $conn->prepare('SELECT request_id FROM scheduled_purchase_requests WHERE verification_code = ? LIMIT 1');
    if (!$checkStmt) {
        throw new RuntimeException('Failed to prepare code check');
    }

    try {
        while (true) {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= $alphabet[random_int(0, $length)];
            }

            $checkStmt->bind_param('s', $code);
            if ($checkStmt->execute()) {
                $res = $checkStmt->get_result();
                if ($res && $res->num_rows === 0) {
                    return $code;
                }
            }
        }
    } finally {
        $checkStmt->close();
    }
}


