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
    $sellerId = require_login();

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        exit;
    }

    $inventoryId = isset($payload['inventory_product_id']) ? (int)$payload['inventory_product_id'] : 0;
    $conversationId = isset($payload['conversation_id']) ? (int)$payload['conversation_id'] : 0;
    $meetingAtRaw = isset($payload['meeting_at']) ? trim((string)$payload['meeting_at']) : '';
    $description = isset($payload['description']) ? trim((string)$payload['description']) : '';
    
    // XSS PROTECTION: Check for XSS patterns in description
    if ($description !== '' && containsXSSPattern($description)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in description']);
        exit;
    }
    
    // New fields for price negotiation and trades
    $negotiatedPrice = isset($payload['negotiated_price']) && $payload['negotiated_price'] !== null 
        ? (float)$payload['negotiated_price'] : null;
    $isTrade = isset($payload['is_trade']) ? (bool)$payload['is_trade'] : false;
    $tradeItemDescription = isset($payload['trade_item_description']) && $payload['trade_item_description'] !== null
        ? trim((string)$payload['trade_item_description']) : null;

    // XSS PROTECTION: Check for XSS patterns in tradeItemDescription
    if ($tradeItemDescription !== null && $tradeItemDescription !== '' && containsXSSPattern($tradeItemDescription)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in trade item description']);
        exit;
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

    // XSS PROTECTION: Check for XSS patterns in customMeetLocation
    if ($customMeetLocation !== '' && containsXSSPattern($customMeetLocation)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid characters in meet location']);
        exit;
    }

    $allowedMeetLocationChoices = ['', 'North Campus', 'South Campus', 'Ellicott', 'Other'];

    if ($meetLocationChoice !== null) {
        if (!in_array($meetLocationChoice, $allowedMeetLocationChoices, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid meet location choice']);
            exit;
        }

        if ($meetLocationChoice === 'Other') {
            if ($customMeetLocation === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Custom meet location is required']);
                exit;
            }
            $meetLocation = $customMeetLocation;
        } elseif ($meetLocationChoice !== '') {
            $meetLocation = $meetLocationChoice;
        }
    }

    if ($inventoryId <= 0 || $conversationId <= 0 || $meetLocation === '' || $meetingAtRaw === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        exit;
    }

    if (strlen($meetLocation) > 30) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Meet location is too long']);
        exit;
    }

    $meetingAt = date_create($meetingAtRaw);
    if ($meetingAt === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid meeting date/time']);
        exit;
    }
    
    // Check if meeting is more than 3 months in the future
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $threeMonthsFromNow = clone $now;
    $threeMonthsFromNow->modify('+3 months');
    
    if ($meetingAt > $threeMonthsFromNow) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Meeting date cannot be more than 3 months in advance']);
        exit;
    }
    
    // Check if meeting is in the past
    if ($meetingAt < $now) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Meeting date cannot be in the past']);
        exit;
    }
    
    $meetingAt->setTimezone(new DateTimeZone('UTC'));
    $meetingAtDb = $meetingAt->format('Y-m-d H:i:s');

    $conn = db();
    $conn->set_charset('utf8mb4');

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $itemStmt = $conn->prepare('SELECT product_id, title, seller_id, price_nego, trades, item_location, listing_price FROM INVENTORY WHERE product_id = ? LIMIT 1');
    if (!$itemStmt) {
        throw new RuntimeException('Failed to prepare inventory query');
    }
    $itemStmt->bind_param('i', $inventoryId);
    $itemStmt->execute();
    $itemRes = $itemStmt->get_result();
    $itemRow = $itemRes ? $itemRes->fetch_assoc() : null;
    $itemStmt->close();

    if (!$itemRow || (int)$itemRow['seller_id'] !== $sellerId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You can only schedule for your own listings']);
        exit;
    }

    // Snapshot mechanism: Capture item settings at scheduling time
    // This ensures that if seller changes item settings (price negotiable, trades, location) 
    // after scheduling, the scheduled purchase still uses the original settings when accepted
    $snapshotPriceNego = isset($itemRow['price_nego']) ? ((int)$itemRow['price_nego'] === 1) : false;
    $snapshotTrades = isset($itemRow['trades']) ? ((int)$itemRow['trades'] === 1) : false;
    $snapshotMeetLocation = isset($itemRow['item_location']) ? trim((string)$itemRow['item_location']) : null;

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $convStmt = $conn->prepare('SELECT conv_id, user1_id, user2_id, user1_deleted, user2_deleted FROM conversations WHERE conv_id = ? LIMIT 1');
    if (!$convStmt) {
        throw new RuntimeException('Failed to prepare conversation query');
    }
    $convStmt->bind_param('i', $conversationId);
    $convStmt->execute();
    $convRes = $convStmt->get_result();
    $convRow = $convRes ? $convRes->fetch_assoc() : null;
    $convStmt->close();

    if (!$convRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Conversation not found']);
        exit;
    }

    $buyerId = 0;
    if ((int)$convRow['user1_id'] === $sellerId) {
        if ((int)$convRow['user1_deleted'] === 1) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Conversation is no longer available']);
            exit;
        }
        $buyerId = (int)$convRow['user2_id'];
    } elseif ((int)$convRow['user2_id'] === $sellerId) {
        if ((int)$convRow['user2_deleted'] === 1) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Conversation is no longer available']);
            exit;
        }
        $buyerId = (int)$convRow['user1_id'];
    } else {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'You do not have access to this conversation']);
        exit;
    }

    if ($buyerId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Could not determine buyer']);
        exit;
    }

    // Ensure buyer is not the seller
    if ($buyerId === $sellerId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Cannot schedule with yourself']);
        exit;
    }

    // Generate unique 4-character verification code for buyer-seller meetup confirmation
    $verificationCode = generateUniqueCode($conn);

    // Validation: Ensure negotiated price is only allowed for price-negotiable items
    if ($negotiatedPrice !== null && !$snapshotPriceNego) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'This item is not marked as price negotiable']);
        exit;
    }

    // Validation: Ensure trade option is only allowed for items that accept trades
    if ($isTrade && !$snapshotTrades) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'This item does not accept trades']);
        exit;
    }

    // Validation: Price and trade are mutually exclusive
    if ($isTrade && $negotiatedPrice !== null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Cannot enter a price for a trade']);
        exit;
    }

    // Validate trade item description if trade is selected
    if ($isTrade && ($tradeItemDescription === null || $tradeItemDescription === '')) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Trade item description is required when trade is selected']);
        exit;
    }

    // Validate negotiated price if provided
    if ($negotiatedPrice !== null) {
        if ($negotiatedPrice < 0 || !is_finite($negotiatedPrice)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid negotiated price']);
            exit;
        }
        if ($negotiatedPrice > 9999.99) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Negotiated price must be $9999.99 or less']);
            exit;
        }
        // Allow 0 as a valid price (free item)
        // But convert empty/whitespace to null for consistency
    }

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
    $stmt = $conn->prepare('INSERT INTO scheduled_purchase_requests (inventory_product_id, seller_user_id, buyer_user_id, conversation_id, meet_location, meeting_at, verification_code, description, negotiated_price, is_trade, trade_item_description, snapshot_price_nego, snapshot_trades, snapshot_meet_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare insert');
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
        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $sellerStmt = $conn->prepare('SELECT first_name, last_name FROM user_accounts WHERE user_id = ? LIMIT 1');
        $sellerStmt->bind_param('i', $sellerId);
        $sellerStmt->execute();
        $sellerRes = $sellerStmt->get_result();
        $sellerRow = $sellerRes ? $sellerRes->fetch_assoc() : null;
        $sellerStmt->close();
        
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
        
        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $nameStmt = $conn->prepare('SELECT user_id, first_name, last_name FROM user_accounts WHERE user_id IN (?, ?)');
        $nameStmt->bind_param('ii', $msgSenderId, $msgReceiverId);
        $nameStmt->execute();
        $nameRes = $nameStmt->get_result();
        $names = [];
        while ($row = $nameRes->fetch_assoc()) {
            $id = (int)$row['user_id'];
            $full = trim((string)$row['first_name'] . ' ' . (string)$row['last_name']);
            $names[$id] = $full !== '' ? $full : ('User ' . $id);
        }
        $nameStmt->close();
        
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
        
        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $msgStmt = $conn->prepare('INSERT INTO messages (conv_id, sender_id, receiver_id, sender_fname, receiver_fname, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $msgStmt->bind_param('iiissss', $conversationId, $msgSenderId, $msgReceiverId, $senderName, $receiverName, $messageContent, $metadata);
        $msgStmt->execute();
        $msgId = $msgStmt->insert_id;
        $msgStmt->close();
        
        // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
        $updateStmt = $conn->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1, first_unread_msg_id = CASE WHEN first_unread_msg_id IS NULL OR first_unread_msg_id = 0 THEN ? ELSE first_unread_msg_id END WHERE conv_id = ? AND user_id = ?');
        $updateStmt->bind_param('iii', $msgId, $conversationId, $msgReceiverId);
        $updateStmt->execute();
        $updateStmt->close();
    }

    // XSS PROTECTION: Escape user-generated content before returning in JSON
    $response = [
        'success' => true,
        'data' => [
            'request_id' => $requestId,
            'inventory_product_id' => $inventoryId,
            'conversation_id' => $conversationId,
            'seller_user_id' => $sellerId,
            'buyer_user_id' => $buyerId,
            'meet_location' => escapeHtml($meetLocation),
            'meeting_at' => $meetingAt->format(DateTime::ATOM),
            'verification_code' => $verificationCode,
            'status' => 'pending',
        ],
    ];

    echo json_encode($response);
} catch (Throwable $e) {
    error_log('scheduled-purchase create error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}

function generateUniqueCode(mysqli $conn): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $length = strlen($alphabet) - 1;

    // SQL INJECTION PROTECTION: Prepared Statement with Parameter Binding
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
            $checkStmt->execute();
            $res = $checkStmt->get_result();
            if ($res && $res->num_rows === 0) {
                return $code;
            }
        }
    } finally {
        $checkStmt->close();
    }
}


