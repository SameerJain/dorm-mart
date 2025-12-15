import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for standardized API calls with loading/error states and AbortController
 * 
 * @param {function} apiCallFn - Function that returns a promise (API call)
 * @param {object} options - Configuration options
 * @param {boolean} options.autoFetch - Whether to fetch automatically on mount (default: true)
 * @param {array} options.dependencies - Dependencies array for useEffect (default: [])
 * @returns {object} { data, loading, error, refetch, reset }
 */
export function useApiCall(apiCallFn, options = {}) {
  const { autoFetch = true, dependencies = [] } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const executeCall = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCallFn(signal);
      if (isMountedRef.current) {
        setData(result);
        setError(null);
      }
      return result;
    } catch (err) {
      if (isMountedRef.current) {
        // Don't set error for AbortError (component unmounted or request cancelled)
        if (err.name !== 'AbortError') {
          setError(err);
        }
        setData(null);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiCallFn]);

  const refetch = useCallback(() => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    return executeCall(abortControllerRef.current.signal);
  }, [executeCall]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (autoFetch) {
      abortControllerRef.current = new AbortController();
      executeCall(abortControllerRef.current.signal).catch(() => {
        // Error already handled in executeCall
      });
    }

    return () => {
      isMountedRef.current = false;
      // Cancel any pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoFetch, executeCall, ...dependencies]);

  return { data, loading, error, refetch, reset };
}



