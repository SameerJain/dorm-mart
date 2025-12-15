<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/auth_handle.php';

// Bootstrap API with POST method and authentication
api_bootstrap('POST', true);

logout_destroy_session();

send_json_success(['message' => 'Logged out successfully']);
