<?php

/**
 * Rate Limiting Module
 * 
 * Functions for managing rate limiting and login attempt tracking
 */

/**
 * Check if session has exceeded rate limit for login attempts
 * @param string $sessionId PHP session ID (PHPSESSID)
 * @return array Rate limit status
 */
function check_rate_limit($sessionId, $maxAttempts = 4, $lockoutMinutes = 3) {
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        
        $conn = db();
        if (!$conn) {
            return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
        }
    
    // Get current attempt count, last attempt time, and lockout status
    $stmt = $conn->prepare("
        SELECT failed_login_attempts, last_failed_attempt, lockout_until 
        FROM login_rate_limits 
        WHERE session_id = ? 
        LIMIT 1
    ");
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
    }
    
    $row = $result->fetch_assoc();
    $stmt->close();
    
    $attempts = (int)$row['failed_login_attempts'];
    $lastAttempt = $row['last_failed_attempt'];
    $lockoutUntil = $row['lockout_until'];
    
    // Check if session is currently locked out FIRST (before decay)
    // If locked out, do NOT apply decay - lockout time must expire completely
    if ($lockoutUntil) {
        $currentTime = time();
        $lockoutExpiry = strtotime($lockoutUntil);
        
        if ($currentTime >= $lockoutExpiry) {
            // Lockout has expired, clear it AND reset attempts
            $updateStmt = $conn->prepare('UPDATE login_rate_limits SET lockout_until = NULL, failed_login_attempts = 0, last_failed_attempt = NULL WHERE session_id = ?');
            $updateStmt->bind_param('s', $sessionId);
            $updateStmt->execute();
            $updateStmt->close();
            $conn->close();
            return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
        }
        
        // Still locked out - return immediately without applying decay
        $conn->close();
        return ['blocked' => true, 'attempts' => $attempts, 'lockout_until' => $lockoutUntil];
    }
    
    // If no attempts, not blocked
    if ($attempts === 0) {
        $conn->close();
        return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
    }
    
    // DECAY SYSTEM: Reduce attempts by 1 if 10+ seconds have passed since last attempt
    // Only apply decay when NOT locked out
    $decaySeconds = 10;
    $currentTime = time();
    $lastAttemptTime = $lastAttempt ? strtotime($lastAttempt) : 0;
    $timeSinceLastAttempt = $currentTime - $lastAttemptTime;
    
    // Apply decay: if 10+ seconds have passed, reduce by exactly 1 (not by time elapsed)
    if ($timeSinceLastAttempt >= $decaySeconds && $attempts > 0) {
        $newAttempts = max(0, $attempts - 1);
        
        // Update attempts if they've decayed
        if ($newAttempts !== $attempts) {
            $updateStmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = ? WHERE session_id = ?');
            $updateStmt->bind_param('is', $newAttempts, $sessionId);
            $updateStmt->execute();
            $updateStmt->close();
            $attempts = $newAttempts;
        }
    }
    
    // Check if we need to start a new lockout (4+ attempts)
    if ($attempts >= $maxAttempts) {
        $currentTime = time();
        $lockoutExpiry = $currentTime + ($lockoutMinutes * 60);
        $lockoutUntil = date('Y-m-d H:i:s', $lockoutExpiry);
        
        // Set lockout timestamp
        $updateStmt = $conn->prepare('UPDATE login_rate_limits SET lockout_until = ? WHERE session_id = ?');
        $updateStmt->bind_param('ss', $lockoutUntil, $sessionId);
        $updateStmt->execute();
        $updateStmt->close();
        
        $conn->close();
        return ['blocked' => true, 'attempts' => $attempts, 'lockout_until' => $lockoutUntil];
    }
    
    // Don't clear timestamps here - let them persist for lockout tracking
    
    $conn->close();
    return ['blocked' => false, 'attempts' => $attempts, 'lockout_until' => null];
    } catch (Exception $e) {
        // If any error occurs, don't block the user
        return ['blocked' => false, 'attempts' => 0, 'lockout_until' => null];
    }
}

/**
 * Record a failed login attempt for rate limiting
 * @param string $sessionId PHP session ID (PHPSESSID)
 */
function record_failed_attempt($sessionId) {
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        
        $conn = db();
        if (!$conn) {
            return; // Silently fail if no database connection
        }
    
    // First check if session record exists and get current attempt data
    $checkStmt = $conn->prepare('SELECT failed_login_attempts, last_failed_attempt FROM login_rate_limits WHERE session_id = ?');
    $checkStmt->bind_param('s', $sessionId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    $checkStmt->close();
    
    if ($result->num_rows > 0) {
        // Session record exists, get current data
        $row = $result->fetch_assoc();
        $currentAttempts = (int)$row['failed_login_attempts'];
        
        // Don't apply decay when recording new attempts - only when checking rate limits
        // This ensures that new attempts are always recorded regardless of time gaps
        
        // Now increment by 1
        $newAttempts = $currentAttempts + 1;
        $stmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = ?, last_failed_attempt = NOW() WHERE session_id = ?');
        $stmt->bind_param('is', $newAttempts, $sessionId);
        $stmt->execute();
        $stmt->close();
        
        // Ensure the update is committed
        $conn->commit();
    } else {
        // Session record doesn't exist, create a new record for rate limiting
        $stmt = $conn->prepare('INSERT INTO login_rate_limits (session_id, failed_login_attempts, last_failed_attempt) VALUES (?, 1, NOW())');
        $stmt->bind_param('s', $sessionId);
        $stmt->execute();
        $stmt->close();
        
        // Ensure the insert is committed
        $conn->commit();
    }
    
    $conn->close();
    } catch (Exception $e) {
        // Silently fail if any error occurs
        return;
    }
}

/**
 * Reset failed login attempts for a session
 * @param string $sessionId PHP session ID (PHPSESSID)
 */
function reset_failed_attempts($sessionId) {
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $stmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = 0, last_failed_attempt = NULL, lockout_until = NULL WHERE session_id = ?');
    $stmt->bind_param('s', $sessionId);
    $stmt->execute();
    $stmt->close();
    $conn->close();
}

/**
 * Get remaining lockout minutes
 * @param string $lockoutUntil Lockout end time
 * @return int Remaining minutes
 */
function get_remaining_lockout_minutes($lockoutUntil) {
    if (empty($lockoutUntil)) {
        return 0;
    }
    
    // Use MySQL to calculate remaining time to avoid timezone issues
    require_once __DIR__ . '/../database/db_connect.php';
    $conn = db();
    $stmt = $conn->prepare("SELECT TIMESTAMPDIFF(SECOND, NOW(), ?) as remaining_seconds");
    $stmt->bind_param('s', $lockoutUntil);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    $remainingSeconds = (int)$row['remaining_seconds'];
    return max(0, ceil($remainingSeconds / 60));
}

/**
 * Reset all lockouts (admin function)
 * Resets all session-based rate limiting lockouts
 */
function reset_all_lockouts() {
    require_once __DIR__ . '/../database/db_connect.php';
    
    $conn = db();
    $stmt = $conn->prepare('UPDATE login_rate_limits SET failed_login_attempts = 0, last_failed_attempt = NULL, lockout_until = NULL');
    $stmt->execute();
    $stmt->close();
    $conn->close();
}

