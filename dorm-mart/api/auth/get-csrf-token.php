<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/auth_handle.php';

// Bootstrap API with GET method and authentication
api_bootstrap('GET', true);

$token = generate_csrf_token();

send_json_success(['csrf_token' => $token]);

