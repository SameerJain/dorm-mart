import { useState, useRef, useEffect, useCallback } from "react";
import { getApiBase } from "../../../utils/api";

/**
 * Hook to manage username fetching and caching
 * @returns {Object} Object containing usernameMap and ensureUsername function
 */
export function useUsernameMapping() {
  const [usernameMap, setUsernameMap] = useState({});
  const usernameCacheRef = useRef({});
  const pendingUsernameRequests = useRef(new Set());

  useEffect(() => {
    usernameCacheRef.current = usernameMap;
  }, [usernameMap]);

  const ensureUsername = useCallback((userId) => {
    if (!userId || usernameCacheRef.current[userId] || pendingUsernameRequests.current.has(userId)) {
      return;
    }
    pendingUsernameRequests.current.add(userId);
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/profile/get_username.php?user_id=${encodeURIComponent(userId)}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && json.username) {
          setUsernameMap((prev) => {
            if (prev[userId]) return prev;
            return { ...prev, [userId]: json.username };
          });
        }
      } catch (_) {
        // ignore errors
      } finally {
        pendingUsernameRequests.current.delete(userId);
      }
    })();
  }, []);

  return { usernameMap, ensureUsername };
}



