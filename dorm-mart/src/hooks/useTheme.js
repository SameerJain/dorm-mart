import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost } from '../utils/api';

export function useTheme() {
  const [theme, setTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);
  const userInitiatedChangeRef = useRef(null); // Track when user changes theme
  const loadAbortControllerRef = useRef(null); // Track abort controller for load operations
  const saveAbortControllerRef = useRef(null); // Track abort controller for save operations

  // Load theme from backend on mount
  useEffect(() => {
    // Cancel any previous load operation
    if (loadAbortControllerRef.current) {
      loadAbortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    loadAbortControllerRef.current = controller;
    
    const loadTheme = async () => {
      // Get user ID for user-specific localStorage
      let userId = null;
      try {
        const meJson = await apiGet('auth/me.php', { signal: controller.signal });
        userId = meJson.user_id;
      } catch (e) {
        if (e.name === 'AbortError') return;
        // User not authenticated - continue without userId
      }

      // Check if user just changed theme - skip backend load if so
      if (userInitiatedChangeRef.current) {
        const timeSinceChange = Date.now() - userInitiatedChangeRef.current;
        if (timeSinceChange < 2000) {
          // User changed theme within last 2 seconds, skip backend load
          setIsLoading(false);
          return;
        }
      }

      try {
        // Check current theme state before clearing
        const currentThemeInDOM = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        
        // Check localStorage first to see if we should preserve the theme
        let shouldPreserveTheme = false;
        if (userId) {
          const userThemeKey = `userTheme_${userId}`;
          const localTheme = localStorage.getItem(userThemeKey);
          if (localTheme && localTheme === currentThemeInDOM) {
            // Current theme matches localStorage for this user - preserve it
            // This prevents flash/reset when navigating between pages
            shouldPreserveTheme = true;
            setTheme(localTheme);
            // Theme is already applied, no need to re-apply
          } else if (localTheme) {
            // localStorage exists but doesn't match - apply it (user switch scenario)
            setTheme(localTheme);
            applyTheme(localTheme);
            // Don't clear since we just applied it
            shouldPreserveTheme = true;
          }
        }
        
        // Only clear theme if we're not preserving it (prevents cross-user contamination)
        if (!shouldPreserveTheme) {
          document.documentElement.classList.remove('dark');
          
          // Try localStorage after clearing (for cases where localStorage wasn't set yet)
          if (userId) {
            const userThemeKey = `userTheme_${userId}`;
            const localTheme = localStorage.getItem(userThemeKey);
            if (localTheme) {
              setTheme(localTheme);
              applyTheme(localTheme);
            }
          }
        }

        // Then get from backend and override localStorage
        try {
          const json = await apiGet('user/preferences.php', { signal: controller.signal });
          if (json?.ok && json?.data?.theme) {
            // Check again if user changed theme during fetch
            if (userInitiatedChangeRef.current) {
              const timeSinceChange = Date.now() - userInitiatedChangeRef.current;
              if (timeSinceChange < 2000) {
                // User changed theme during fetch, don't overwrite
                setIsLoading(false);
                return;
              }
            }
            setTheme(json.data.theme);
            applyTheme(json.data.theme);
            // Update localStorage with backend value
            if (userId) {
              const userThemeKey = `userTheme_${userId}`;
              localStorage.setItem(userThemeKey, json.data.theme);
            }
          } else {
            // If no theme from backend, use localStorage or default to light
            if (userId) {
              const userThemeKey = `userTheme_${userId}`;
              const localTheme = localStorage.getItem(userThemeKey);
              if (localTheme) {
                setTheme(localTheme);
                applyTheme(localTheme);
              }
            }
          }
        } catch (apiError) {
          if (apiError.name === 'AbortError') return;
          // API call failed, fall through to localStorage fallback below
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
        console.warn('Failed to load theme:', e);
        // Fallback to localStorage if API fails
        if (userId) {
          const userThemeKey = `userTheme_${userId}`;
          const localTheme = localStorage.getItem(userThemeKey);
          if (localTheme) {
            setTheme(localTheme);
            applyTheme(localTheme);
          }
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadTheme();
    
    // Cleanup: abort on unmount
    return () => {
      controller.abort();
    };
  }, []);

  // Apply theme to document
  const applyTheme = (newTheme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Save theme to backend and localStorage
  const saveTheme = async (newTheme) => {
    // Cancel any previous save operation
    if (saveAbortControllerRef.current) {
      saveAbortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    saveAbortControllerRef.current = controller;
    
    // Get user ID for user-specific localStorage
    let userId = null;
    try {
      const meJson = await apiGet('auth/me.php', { signal: controller.signal });
      userId = meJson.user_id;
    } catch (e) {
      if (e.name === 'AbortError') return;
      // User not authenticated
    }

    // Save to localStorage immediately with user-specific key
    if (userId) {
      const userThemeKey = `userTheme_${userId}`;
      localStorage.setItem(userThemeKey, newTheme);
    }
    
    try {
      // POST theme directly - UserPreferences already handles full preferences save
      // This is a minimal save that won't conflict with UserPreferences auto-save
      await apiPost('user/preferences.php', { theme: newTheme }, { signal: controller.signal });
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('Failed to save theme:', e);
      }
    }
  };

  // Update theme function
  const updateTheme = (newTheme) => {
    // Mark that user initiated this change
    userInitiatedChangeRef.current = Date.now();
    setTheme(newTheme);
    applyTheme(newTheme);
    saveTheme(newTheme);
  };

  return { theme, updateTheme, isLoading };
}
