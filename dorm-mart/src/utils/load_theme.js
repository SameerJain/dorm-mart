import { getApiBase } from './api';

// Load user theme from backend and localStorage
export const loadUserTheme = async () => {
  // First clear any existing theme to prevent cross-user contamination
  document.documentElement.classList.remove('dark');
  
  // Get user ID for user-specific localStorage
  let userId = null;
  try {
    const meRes = await fetch(`${getApiBase()}/auth/me.php`, { 
      method: 'GET', 
      credentials: 'include' 
    });
    if (meRes.ok) {
      const meJson = await meRes.json();
      userId = meJson.user_id;
    }
  } catch (e) {
    // User not authenticated
  }

  // Try localStorage first for immediate application
  if (userId) {
    const userThemeKey = `userTheme_${userId}`;
    const localTheme = localStorage.getItem(userThemeKey);
    if (localTheme) {
      if (localTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  // Then get from backend and override localStorage
  try {
    const res = await fetch(`${getApiBase()}/user/preferences.php`, { 
      method: 'GET', 
      credentials: 'include' 
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.ok && json?.data?.theme) {
        // Apply theme from backend
        if (json.data.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        // Update localStorage with backend value
        if (userId) {
          const userThemeKey = `userTheme_${userId}`;
          localStorage.setItem(userThemeKey, json.data.theme);
        }
      }
    }
  } catch (e) {
    // User not authenticated or error - default to light theme
    document.documentElement.classList.remove('dark');
  }
};

