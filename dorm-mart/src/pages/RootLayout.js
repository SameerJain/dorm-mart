import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useContext } from "react";
import MainNav from "../components/MainNav/MainNav";
import { fetch_me } from "../utils/handle_auth.js";
import { loadUserTheme } from "../utils/load_theme.js";
import { ChatContext } from "../context/ChatContext.js";
import FAQModal from "./FAQPage/FAQModal.jsx";

// once user logs in, load websocket
function RootLayout() {
  
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const isChatPage = location.pathname.startsWith("/app/chat");
  const chatContext = useContext(ChatContext);
  // Check if we're viewing a conversation (activeConvId exists) or the list (no activeConvId)
  const isViewingConversation = chatContext?.activeConvId != null;

  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);

  const handleFAQClick = (event) => {
    // Remove focus from the button after click
    event.currentTarget.blur();
    // Open the FAQ modal
    setIsFAQModalOpen(true);
  };

  const handleCloseFAQ = () => {
    setIsFAQModalOpen(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    
    const checkAuth = async () => {
      try {
        await fetch_me(controller.signal);
        setIsAuthenticated(true);
        setIsChecking(false);
        // Load user theme after authentication is confirmed
        loadUserTheme();
      } catch (error) {
        // AbortError means component unmounted, don't update state or navigate
        if (error.name === 'AbortError') {
          return;
        }
        // Not authenticated, redirect to login
        setIsChecking(false);
        navigate("/login", { replace: true });
      }
    };

    checkAuth();
    
    // Cleanup: abort fetch if component unmounts
    return () => {
      controller.abort();
    };
  }, [navigate]);

  // Scroll to top when navigating to a new page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Show loading state while checking authentication
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Only render if authenticated
  if (!isAuthenticated) {
    return null; // Will redirect, but return null as fallback
  }

  return (
    <>
      {/* Show navbar on mobile for chat list, hide for individual conversations */}
      <div className={isChatPage && isViewingConversation ? "hidden md:block" : ""}>
        <MainNav />
      </div>
      <Outlet />

      <button
        type="button"
        onClick={handleFAQClick}
        className="
          fixed bottom-7 right-7 z-50
          h-12 w-12 flex items-center justify-center
          rounded-full shadow-lg
          bg-blue-600 text-white
          hover:bg-blue-700
          dark:bg-blue-500 dark:hover:bg-blue-600
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          qna-bounce-z
          transition-transform
        "
        aria-label="FAQ"
      >
        ?
      </button>

      <FAQModal isOpen={isFAQModalOpen} onClose={handleCloseFAQ} />

    </>
  );
}

export default RootLayout;
