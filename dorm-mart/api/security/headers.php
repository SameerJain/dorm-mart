<?php

/**
 * Security Headers Module
 * 
 * Sets comprehensive security headers for all API endpoints
 */

/**
 * Set comprehensive security headers for all API endpoints
 * This function should be called at the start of every API endpoint
 */
function setSecurityHeaders() {
    // Content Security Policy - Prevents XSS by controlling resource loading
    // Restricts which resources can be loaded and executed
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';");
    
    // X-XSS-Protection - Enables browser's built-in XSS filter
    header("X-XSS-Protection: 1; mode=block");
    
    // X-Content-Type-Options - Prevents MIME type sniffing
    header("X-Content-Type-Options: nosniff");
    
    // X-Frame-Options - Prevents clickjacking
    header("X-Frame-Options: DENY");
    
    // Referrer Policy - Controls referrer information
    header("Referrer-Policy: strict-origin-when-cross-origin");
    
    // Permissions Policy - Controls browser features
    header("Permissions-Policy: geolocation=(), microphone=(), camera=()");
    
    // Remove X-Powered-By header to hide PHP version
    header_remove('X-Powered-By');
}



