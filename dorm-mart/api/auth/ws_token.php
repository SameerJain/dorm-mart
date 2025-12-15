<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../utility/env_config.php';

// Bootstrap API with GET method and authentication
$result = api_bootstrap('GET', true);
$userId = $result['userId'];

$secret = get_env_var('WS_TOKEN_SECRET');
if (!$secret) {
    send_json_error(500, 'Server misconfigured');
}

$payload = [
    'uid'  => $userId,
    'exp'  => time() + 60,
    'jti'  => bin2hex(random_bytes(8)),
];

$payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES);
$payloadB64  = b64url($payloadJson);
$sigB64      = b64url(hash_hmac('sha256', $payloadB64, $secret, true));

$token = $payloadB64 . '.' . $sigB64;
send_json_success(['token' => $token]);

// --- helpers ---
function b64url(string $data): string {
    // base64 URL variant: +/ -> -_, strip =
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}




