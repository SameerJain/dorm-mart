import { apiGet, apiPost } from './api';

// Logout function - calls backend to clear auth token
export async function logout() {
  try {
    // Get user ID before logout to clear user-specific theme
    let userId = null;
    try {
      const meJson = await fetch_me();
      userId = meJson.user_id;
    } catch (e) {
      // User not authenticated
    }

    await apiPost('auth/logout.php', {});

    // Clear theme from DOM and localStorage on logout
    document.documentElement.classList.remove('dark');
    
    // Clear user-specific theme from localStorage
    if (userId) {
      const userThemeKey = `userTheme_${userId}`;
      localStorage.removeItem(userThemeKey);
    }

    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

// if user authenticated, return {"success": true, 'user_id': user_id}
export async function fetch_me(signal) {
  return await apiGet('auth/me.php', { signal });
}



