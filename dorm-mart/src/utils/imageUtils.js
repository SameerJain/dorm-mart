/**
 * Image Path Utilities
 * 
 * Centralized functions for handling image paths in the frontend
 */

/**
 * Normalize image path to standard format
 * @param {string} path - Image path (can be /images/, or just filename)
 * @returns {string} Normalized path starting with /images/
 */
export function normalizeImagePath(path) {
  if (!path || typeof path !== 'string') {
    return '';
  }
  
  const trimmed = path.trim();
  if (trimmed === '') {
    return '';
  }
  
  // If it's already a full URL (http/https), return as-is
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }
  
  // If it starts with /images/, return as-is
  if (trimmed.startsWith('/images/')) {
    return trimmed;
  }
  
  // If it starts with /data/images/ (legacy), convert to /images/
  if (trimmed.startsWith('/data/images/')) {
    const filename = trimmed.split('/').pop();
    return '/images/' + filename;
  }
  
  // If it's just a filename, prepend /images/
  if (!trimmed.includes('/')) {
    return '/images/' + trimmed;
  }
  
  // If it starts with / but not /images/, extract filename and use /images/
  if (trimmed.startsWith('/')) {
    const filename = trimmed.split('/').pop();
    return '/images/' + filename;
  }
  
  // Default: treat as filename and prepend /images/
  return '/images/' + trimmed;
}

/**
 * Check if an image path should be proxied through image.php
 * @param {string} path - Image path
 * @returns {boolean} True if path should be proxied
 */
export function shouldProxyImage(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }
  
  // Proxy remote URLs
  if (/^https?:\/\//i.test(path)) {
    return true;
  }
  
  // Proxy /images/ paths
  if (path.startsWith('/images/')) {
    return true;
  }
  
  // Proxy /media/ paths
  if (path.startsWith('/media/')) {
    return true;
  }
  
  return false;
}

/**
 * Get proxied image URL for frontend use
 * @param {string} path - Image path
 * @param {Function} getApiBase - Function to get API base URL
 * @returns {string} Proxied URL or original path
 */
export function getProxiedImageUrl(path, getApiBase) {
  if (!path) {
    return '';
  }
  
  if (shouldProxyImage(path)) {
    return `${getApiBase()}/media/image.php?url=${encodeURIComponent(path)}`;
  }
  
  return path;
}

