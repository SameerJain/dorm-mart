/**
 * Centralized API Client Utilities
 * 
 * Provides consistent API base URL handling and fetch wrappers
 * to reduce code duplication across React components.
 */

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

/**
 * Get the public base URL
 * @returns {string} Public base URL
 */
export function getPublicBase() {
  return PUBLIC_BASE;
}

/**
 * Get the API base URL
 * @returns {string} API base URL
 */
export function getApiBase() {
  return API_BASE;
}

/**
 * Base fetch wrapper with default headers and credentials
 * @param {string} url - API endpoint URL (relative to API_BASE or absolute)
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function apiFetch(url, options = {}) {
  // If URL doesn't start with http, prepend API_BASE
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
  
  const defaultOptions = {
    credentials: 'include', // Always include cookies for session auth
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  return fetch(fullUrl, mergedOptions);
}

/**
 * GET request helper
 * @param {string} url - API endpoint URL
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiGet(url, options = {}) {
  const response = await apiFetch(url, {
    ...options,
    method: 'GET',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Handle both old and new response formats
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * POST request helper
 * @param {string} url - API endpoint URL
 * @param {object|FormData} data - Request body data (object will be JSON stringified, FormData sent as-is)
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiPost(url, data = null, options = {}) {
  // Handle FormData separately - don't JSON stringify it
  const isFormData = data instanceof FormData;
  const body = data !== null ? (isFormData ? data : JSON.stringify(data)) : undefined;
  
  // For FormData, don't set Content-Type header (browser will set it with boundary)
  // For JSON, set Content-Type header
  const headers = isFormData 
    ? {} // Let browser set Content-Type with boundary for FormData
    : {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  // Build fetch options - for FormData, bypass apiFetch's default headers
  const fetchOptions = isFormData
    ? {
        ...options,
        method: 'POST',
        body,
        credentials: 'include',
        headers: {
          ...headers,
          ...options.headers,
        },
      }
    : {
        ...options,
        method: 'POST',
        body,
      };

  // Use apiFetch for JSON, direct fetch for FormData to avoid header conflicts
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}/${url.replace(/^\//, '')}`;
  const response = isFormData 
    ? await fetch(fullUrl, fetchOptions)
    : await apiFetch(url, fetchOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Handle both old and new response formats
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * PUT request helper
 * @param {string} url - API endpoint URL
 * @param {object} data - Request body data
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiPut(url, data = null, options = {}) {
  const body = data !== null ? JSON.stringify(data) : undefined;

  const response = await apiFetch(url, {
    ...options,
    method: 'PUT',
    body,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Handle both old and new response formats
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * DELETE request helper
 * @param {string} url - API endpoint URL
 * @param {object} data - Optional request body data
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiDelete(url, data = null, options = {}) {
  const body = data !== null ? JSON.stringify(data) : undefined;

  const response = await apiFetch(url, {
    ...options,
    method: 'DELETE',
    body,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Handle both old and new response formats
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Fetch with AbortController support
 * @param {string} url - API endpoint URL
 * @param {AbortSignal} signal - AbortSignal for cancellation
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
export async function apiGetWithSignal(url, signal, options = {}) {
  return apiGet(url, { ...options, signal });
}

