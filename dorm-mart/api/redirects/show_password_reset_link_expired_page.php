<?php
// Universal page for expired/invalid reset links
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Link Expired - Dorm Mart</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #1e3a8a;
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 500px;
            text-align: center;
        }

        .logo {
            margin-bottom: 2rem;
        }

        .logo h1 {
            color: #333;
            margin: 0;
            font-size: 2rem;
        }

        .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }

        .message {
            background: #fff3cd;
            color: #856404;
            padding: 1rem;
            border-radius: 5px;
            margin-bottom: 1.5rem;
            border: 1px solid #ffeaa7;
        }

        .info {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 5px;
            margin-bottom: 1.5rem;
            font-size: 0.9rem;
            color: #666;
        }

        .btn {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #1e3a8a;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-size: 1rem;
            transition: background 0.3s;
        }

        .btn:hover {
            background: #1e40af;
        }

        .back-to-login {
            margin-top: 1rem;
        }

        .back-to-login a {
            color: #1e3a8a;
            text-decoration: none;
        }

        .back-to-login a:hover {
            text-decoration: underline;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="logo">
            <h1>Dorm Mart</h1>
        </div>

        <div class="icon">⏰</div>

        <div class="message">
            <h2>Reset Link Expired or Invalid</h2>
            <p>A new password reset email has been sent. This link is from an older email and is no longer valid.</p>
        </div>

        <div class="info">
            <p><strong>What happened?</strong></p>
            <ul style="text-align: left; margin: 0.5rem 0;">
                <li>You may have requested multiple password resets</li>
                <li>Only the most recent reset link is valid</li>
                <li>Reset links expire after 1 hour for security</li>
            </ul>
        </div>

        <?php
        // Use environment configuration for frontend URLs
        require_once __DIR__ . '/../utility/env_config.php';
        
        $frontendBaseUrl = get_frontend_base_url();
        
        // Extract path from full URL if needed, or use as-is if relative
        if (strpos($frontendBaseUrl, 'http://') === 0 || strpos($frontendBaseUrl, 'https://') === 0) {
            // Parse URL to get path
            $parsed = parse_url($frontendBaseUrl);
            $basePath = $parsed['path'] ?? '';
        } else {
            // Already a path
            $basePath = $frontendBaseUrl;
        }
        
        // Ensure basePath starts with /
        if ($basePath === '' || $basePath[0] !== '/') {
            $basePath = '/' . $basePath;
        }
        
        // Remove trailing slash
        $basePath = rtrim($basePath, '/');
        
        $loginLink = $basePath . '/#/login';
        $forgotLink = $basePath . '/#/forgot-password';
        ?>

        <a href="<?php echo $loginLink; ?>" class="btn">Go to Login</a>

        <div class="back-to-login">
            <a href="<?php echo $forgotLink; ?>">Request New Reset Link</a>
        </div>
    </div>
</body>

</html>