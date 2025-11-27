<?php
/**
 * Session Rate Limiting Monitor
 * 
 * This script allows you to monitor session login attempts, decay events, and rate limiting status.
 * 
 * USAGE:
 * php api/utility/monitor_user_attempts.php [session_id]
 * 
 * Examples:
 * php api/utility/monitor_user_attempts.php abc123def456...
 * 
 * NOTE: Rate limiting is now session-based. Use session_id (PHPSESSID) instead of email.
 */

require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../security/security.php';

// Get session_id from command line argument
$sessionId = $argv[1] ?? '';

if (empty($sessionId)) {
    echo "Usage: php api/utility/monitor_user_attempts.php [session_id]\n";
    echo "Example: php api/utility/monitor_user_attempts.php abc123def456ghi789...\n";
    echo "\n";
    echo "NOTE: Rate limiting is now session-based (PHPSESSID) instead of email-based.\n";
    echo "You can find your session ID in browser cookies (PHPSESSID) or session files.\n";
    exit(1);
}

echo "=== SESSION RATE LIMITING MONITOR ===\n";
echo "Session ID: " . substr($sessionId, 0, 32) . "...\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n";
echo str_repeat("=", 50) . "\n\n";

// Get current session status
$conn = db();
$stmt = $conn->prepare('SELECT failed_login_attempts, last_failed_attempt, lockout_until FROM login_rate_limits WHERE session_id = ?');
$stmt->bind_param('s', $sessionId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo "✅ No rate limiting data found for this session\n";
    echo "   This session has no failed login attempts recorded.\n";
    $stmt->close();
    $conn->close();
    exit(0);
}

$row = $result->fetch_assoc();
$stmt->close();
$conn->close();

$attempts = (int)$row['failed_login_attempts'];
$lastAttempt = $row['last_failed_attempt'];
$lockoutUntil = $row['lockout_until'];

echo "📊 CURRENT STATUS:\n";
echo "  Failed Attempts: $attempts\n";
echo "  Last Attempt: " . ($lastAttempt ?: 'Never') . "\n";

if ($lastAttempt) {
    $timeSince = time() - strtotime($lastAttempt);
    echo "  Time Since Last Attempt: " . formatTime($timeSince) . "\n";
    echo "  Decay Cycles (every 10s): " . floor($timeSince / 10) . "\n";
    echo "  Expected Attempts After Decay: " . max(0, $attempts - floor($timeSince / 10)) . "\n";
    echo "  🔄  Decay reduces attempts by 1 every 10 seconds\n";
}

echo "\n";

// Check rate limiting status
echo "🔒 RATE LIMITING STATUS:\n";
$rateLimitCheck = check_rate_limit($sessionId);
if ($rateLimitCheck['blocked']) {
    $remainingMinutes = get_remaining_lockout_minutes($rateLimitCheck['lockout_until']);
    echo "  Status: 🔴 LOCKED OUT\n";
    echo "  Remaining Time: $remainingMinutes minutes\n";
    echo "  Lockout Until: " . $rateLimitCheck['lockout_until'] . "\n";
} else {
    echo "  Status: 🟢 NOT LOCKED OUT\n";
    echo "  Current Attempts: " . $rateLimitCheck['attempts'] . "\n";
}

echo "\n";

// Show decay simulation
if ($attempts > 0 && $lastAttempt) {
    echo "⏰ DECAY SIMULATION:\n";
    $currentTime = time();
    $lastAttemptTime = strtotime($lastAttempt);
    $timeSince = $currentTime - $lastAttemptTime;
    
    echo "  Current Time: " . date('Y-m-d H:i:s', $currentTime) . "\n";
    echo "  Last Attempt: " . date('Y-m-d H:i:s', $lastAttemptTime) . "\n";
    echo "  Time Elapsed: " . formatTime($timeSince) . "\n";
    
    $decayCycles = floor($timeSince / 10);
    $expectedAttempts = max(0, $attempts - $decayCycles);
    
    echo "  Decay Cycles: $decayCycles (every 10 seconds)\n";
    echo "  Original Attempts: $attempts\n";
    echo "  Expected After Decay: $expectedAttempts\n";
    
    if ($expectedAttempts < $attempts) {
        echo "  🎯 DECAY WOULD REDUCE ATTEMPTS BY: " . ($attempts - $expectedAttempts) . "\n";
    }
    
    // Show when decay would complete
    if ($attempts > 0) {
        $secondsToComplete = ($attempts * 10) - $timeSince;
        if ($secondsToComplete > 0) {
            echo "  ⏳ Time Until All Decay: " . formatTime($secondsToComplete) . "\n";
        } else {
            echo "  ✅ All decay would be complete!\n";
        }
    }
}

echo "\n";

// Show lockout expiry
if ($lockoutUntil) {
    $lockoutExpiry = strtotime($lockoutUntil);
    $currentTime = time();
    $remainingLockout = $lockoutExpiry - $currentTime;
    
    echo "🚫 LOCKOUT STATUS:\n";
    echo "  Lockout Until: " . date('Y-m-d H:i:s', $lockoutExpiry) . "\n";
    
    if ($remainingLockout > 0) {
        echo "  Remaining Lockout: " . formatTime($remainingLockout) . "\n";
    } else {
        echo "  ✅ Lockout has expired!\n";
    }
}

echo "\n" . str_repeat("=", 50) . "\n";
echo "💡 TIP: Run this script again to see updated status after decay\n";

/**
 * Format seconds into human-readable time
 */
function formatTime($seconds) {
    if ($seconds < 60) {
        return "$seconds seconds";
    } elseif ($seconds < 3600) {
        $minutes = floor($seconds / 60);
        $remainingSeconds = $seconds % 60;
        return "$minutes minutes, $remainingSeconds seconds";
    } else {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        return "$hours hours, $minutes minutes";
    }
}
?>
