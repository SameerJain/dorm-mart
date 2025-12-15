<?php
declare(strict_types=1);

// dorm-mart/api/search/getSearchItems.php

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../database/db_helpers.php';
require_once __DIR__ . '/../helpers/data_parsers.php';
require_once __DIR__ . '/../profile/profile_helpers.php';
require_once __DIR__ . '/../security/security.php';

// Bootstrap API with POST method and authentication
$result = api_bootstrap('POST', true);
$userId = $result['userId'];
$mysqli = $result['conn'];

try {
    // Parse request data (handles both JSON and form data)
    $body = get_request_data();

    $qRaw      = isset($body['q']) ? trim((string)$body['q']) : (isset($body['search']) ? trim((string)$body['search']) : '');
    $category  = isset($body['category']) ? trim((string)$body['category']) : '';
    
    // XSS PROTECTION: Filtering (Layer 1) - blocks patterns before DB storage
    if ($qRaw !== '' && containsXSSPattern($qRaw)) {
        send_json_error(400, 'Invalid characters in search query');
    }
    
    $q = $qRaw;
    // Optional multiple categories support
    $categories = [];
    if (isset($body['categories'])) {
        if (is_array($body['categories'])) {
            foreach ($body['categories'] as $c) {
                $c = trim((string)$c);
                if ($c !== '') $categories[] = $c;
            }
        } else {
            $parts = explode(',', (string)$body['categories']);
            foreach ($parts as $c) {
                $c = trim($c);
                if ($c !== '') $categories[] = $c;
            }
        }
    }
    $condition = isset($body['condition']) ? trim((string)$body['condition']) : '';
    $location  = isset($body['location']) ? trim((string)$body['location']) : '';
    $status    = isset($body['status']) ? strtoupper(trim((string)$body['status'])) : '';
    $minPrice  = isset($body['minPrice']) ? (float)$body['minPrice'] : null;
    $maxPrice  = isset($body['maxPrice']) ? (float)$body['maxPrice'] : null;
    $sort      = isset($body['sort']) ? strtolower(trim((string)$body['sort'])) : '';
    // Optional: include description in search when true
    $includeDesc = false;
    if (isset($body['includeDescription'])) {
        $v = strtolower(trim((string)$body['includeDescription']));
        $includeDesc = in_array($v, ['1','true','yes','on'], true);
    } elseif (isset($body['scope'])) {
        $includeDesc = strtolower(trim((string)$body['scope'])) !== 'title';
    }
    $limit     = isset($body['limit']) ? max(1, min(100, (int)$body['limit'])) : 50;


    // Base select (we may append a dynamic relevance column when searching)
    $selectCols = "
            i.product_id,
            i.title,
            i.categories,
            i.item_location,
            i.item_condition,
            i.description,
            i.photos,
            i.listing_price,
            i.trades,
            i.price_nego,
            i.date_listed,
            i.seller_id,
            i.sold,
            ua.first_name,
            ua.last_name,
            ua.email
    ";

    $relevanceSql = '';
    $relevanceParams = [];
    $relevanceTypes = '';

    // If searching and sort is empty or explicitly set to best, prioritize similarity
    $useRelevance = ($q !== '') && in_array($sort, ['', 'best', 'best_match', 'relevance'], true);
    if ($useRelevance) {
        // Weighted matches: exact > prefix > contains (title), optional description contains
        $relevanceSql = ", ( ".
            " (CASE WHEN i.title = ? THEN 100 ELSE 0 END) +".
            " (CASE WHEN i.title LIKE ? THEN 50 ELSE 0 END) +".
            " (CASE WHEN i.title LIKE ? THEN 20 ELSE 0 END) ";
        $relevanceParams[] = $q;                 // exact
        $relevanceParams[] = $q . '%';           // prefix
        $relevanceParams[] = '%' . $q . '%';     // title contains
        $relevanceTypes   .= 'sss';
        if ($includeDesc) {
            $relevanceSql .= "+ (CASE WHEN i.description LIKE ? THEN 10 ELSE 0 END) ";
            $relevanceParams[] = '%' . $q . '%'; // desc contains
            $relevanceTypes   .= 's';
        }
        $relevanceSql .= ") AS relevance ";
    }

    $sql = "SELECT " . $selectCols . $relevanceSql . "\n" .
           "FROM INVENTORY AS i\n" .
           "LEFT JOIN user_accounts AS ua ON i.seller_id = ua.user_id\n";

    $where = [];
    $params = [];
    $types = '';

    // Enforce only Active and not sold
    $where[] = 'i.item_status = ?';
    $params[] = 'Active';
    $types   .= 's';
    $where[] = '(i.sold IS NULL OR i.sold = 0)';

    // Category is stored as JSON array (column: categories)
    if ($category !== '') {
        // Match a single category
        $where[] = 'JSON_CONTAINS(i.categories, ?, "$")';
        $params[] = json_encode($category, JSON_UNESCAPED_UNICODE);
        $types   .= 's';
    } elseif (!empty($categories)) {
        // Match any of the provided categories
        $parts = [];
        foreach ($categories as $cat) {
            $parts[] = 'JSON_CONTAINS(i.categories, ?, "$")';
            $params[] = json_encode($cat, JSON_UNESCAPED_UNICODE);
            $types   .= 's';
        }
        if (!empty($parts)) {
            $where[] = '(' . implode(' OR ', $parts) . ')';
        }
    }

    // Condition and location (exact matches)
    if ($condition !== '') {
        $where[] = 'i.item_condition = ?';
        $params[] = $condition;
        $types   .= 's';
    }
    if ($location !== '') {
        $where[] = 'i.item_location = ?';
        $params[] = $location;
        $types   .= 's';
    }

    // Optional toggles
    $priceNegoIn = null;
    if (isset($body['priceNego'])) $priceNegoIn = (string)$body['priceNego'];
    if (isset($body['priceNegotiable'])) $priceNegoIn = (string)$body['priceNegotiable'];
    if ($priceNegoIn !== null) {
        $priceNegoBool = in_array(strtolower(trim($priceNegoIn)), ['1','true','yes','on'], true);
        if ($priceNegoBool) {
            $where[] = 'i.price_nego = 1';
        }
    }
    if (isset($body['trades'])) {
        $tradesBool = in_array(strtolower(trim((string)$body['trades'])), ['1','true','yes','on'], true);
        if ($tradesBool) {
            $where[] = 'i.trades = 1';
        }
    }

    // Search query across title (and optionally description)
    if ($q !== '') {
        if ($includeDesc) {
            $where[] = '(i.title LIKE ? OR i.description LIKE ?)';
            $params[] = '%' . $q . '%';
            $params[] = '%' . $q . '%';
            $types   .= 'ss';
        } else {
            $where[] = 'i.title LIKE ?';
            $params[] = '%' . $q . '%';
            $types   .= 's';
        }
    }

    // Price range
    if ($minPrice !== null) {
        $where[] = 'i.listing_price >= ?';
        $params[] = $minPrice;
        $types   .= 'd';
    }
    if ($maxPrice !== null) {
        $where[] = 'i.listing_price <= ?';
        $params[] = $maxPrice;
        $types   .= 'd';
    }

    if (!empty($where)) {
        $sql .= ' WHERE ' . implode(' AND ', $where) . "\n";
    }

    // Sorting
    $order = ' ORDER BY i.date_listed DESC, i.product_id DESC ';
    if ($useRelevance) {
        $order = ' ORDER BY relevance DESC, i.date_listed DESC, i.product_id DESC ';
    } elseif ($sort === 'new' || $sort === 'newest') {
        $order = ' ORDER BY i.date_listed DESC, i.product_id DESC ';
    } elseif ($sort === 'old' || $sort === 'oldest') {
        $order = ' ORDER BY i.date_listed ASC, i.product_id ASC ';
    } elseif ($sort === 'price_asc') {
        $order = ' ORDER BY i.listing_price ASC, i.product_id DESC ';
    } elseif ($sort === 'price_desc') {
        $order = ' ORDER BY i.listing_price DESC, i.product_id DESC ';
    }
    $sql .= $order . "\n" . ' LIMIT ? ';

    $stmt = $mysqli->prepare($sql);
    if ($stmt === false) {
        throw new Exception('Prepare failed: ' . $mysqli->error);
    }

    // Bind params: where params, then relevance params (if any), then limit
    $typesWithLimit = $relevanceTypes . $types . 'i';
    $paramsWithLimit = array_merge($relevanceParams, $params);
    $paramsWithLimit[] = $limit;

    if ($typesWithLimit !== '') {
        $stmt->bind_param($typesWithLimit, ...$paramsWithLimit);
    }

    if (!$stmt->execute()) {
        throw new Exception('Execute failed: ' . $stmt->error);
    }

    $res = $stmt->get_result();
    $out = [];
    $now = time();
    while ($row = $res->fetch_assoc()) {
        // Use helpers for parsing
        $tags = parse_categories_json($row['categories'] ?? null);
        
        // photos JSON -> first photo path (special handling for array format with 'url' key)
        $image = null;
        if (!empty($row['photos'])) {
            $photos = parse_photos_json($row['photos']);
            if (!empty($photos) && is_array($photos)) {
                $first = $photos[0];
                if (is_string($first)) {
                    $image = $first;
                } elseif (is_array($first) && isset($first['url'])) {
                    $image = $first['url'];
                }
            }
        }

        // status from date_listed
        $statusOut = 'AVAILABLE';
        $createdAt = null;
        if (!empty($row['date_listed'])) {
            $createdAt = $row['date_listed'] . ' 00:00:00';
            $ts = strtotime($row['date_listed']);
            if ($ts !== false) {
                $diffHrs = ($now - $ts) / 3600;
                if ($diffHrs < 48) {
                    $statusOut = 'JUST POSTED';
                }
            }
        }
        if ((int)($row['sold'] ?? 0) === 1) {
            $statusOut = 'SOLD';
        }

        // seller name using helper
        $seller = build_seller_name($row);

        // Note: No HTML encoding needed for JSON responses - React handles XSS protection automatically
        $out[] = [
            'id'         => (int)$row['product_id'],
            'title'      => $row['title'] ?? 'Untitled',
            'price'      => $row['listing_price'] !== null ? (float)$row['listing_price'] : 0,
            'image'      => $image,
            'image_url'  => $image,
            'tags'       => $tags,
            'category'   => !empty($tags) ? $tags[0] : null,
            'location'   => $row['item_location'] ?? '', // Note: No HTML encoding needed for JSON - React handles XSS protection
            'condition'  => $row['item_condition'] ?? '',
            'created_at' => $createdAt,
            'seller'     => $seller,
            'sold_by'    => $seller,
            'status'     => $statusOut,
            'trades'     => (bool)$row['trades'],
            'price_nego' => (bool)$row['price_nego'],
        ];
    }

    send_json_success($out);

} catch (Throwable $e) {
    error_log('getSearchItems error: ' . $e->getMessage());
    // SECURITY: In production, consider removing 'detail' field to prevent information disclosure
    send_json_error(500, 'Server error', ['detail' => $e->getMessage()]);
}
