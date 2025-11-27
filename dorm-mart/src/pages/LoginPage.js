import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetch_me } from "../utils/handle_auth.js";
import PreLoginBranding from "../components/PreLoginBranding";
// Client no longer inspects cookies; auth is enforced server-side on protected routes

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const controller = new AbortController();
    
    const checkAuth = async () => {
      try {
        await fetch_me(controller.signal);
        // User is authenticated, redirect to app
        navigate("/app", { replace: true });
      } catch (error) {
        // AbortError means component unmounted, don't navigate
        if (error.name === 'AbortError') {
          return;
        }
        // User is not authenticated, stay on login page
      }
    };

    checkAuth();
    
    // Cleanup: abort fetch if component unmounts
    return () => {
      controller.abort();
    };
  }, [navigate]);

  // Handle URL parameters
  useEffect(() => {
    const urlError = searchParams.get('error');
    const urlMessage = searchParams.get('message');
    
    if (urlError === 'reset_link_expired') {
      setError("Password reset link has expired. Please request a new one.");
    } else if (urlError === 'invalid_reset_link') {
      setError("Invalid password reset link. Please use the link from your email.");
    }
    
    if (urlMessage === 'password_reset_success') {
      setSuccess("Password has been reset successfully. You can now log in with your new password.");
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setLoading(true);

    // Validate input lengths FIRST (prevent excessively large inputs)
    if (email.length >= 50 || password.length >= 64) {
      setError("Username or password is too large");
      setLoading(false);
      return;
    }

    // XSS PROTECTION: Check for XSS patterns in email field
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /onclick=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<img[^>]*on/i,
      /<svg[^>]*on/i,
      /vbscript:/i
    ];
    
    const emailTrimmed = email.trim();
    if (xssPatterns.some(pattern => pattern.test(emailTrimmed))) {
      setError("Invalid email format");
      setLoading(false);
      return;
    }

    // Frontend validation
    if (emailTrimmed === "" && password.trim() === "") {
      setError("Missing required fields");
      setLoading(false);
      return;
    }

    if (emailTrimmed === "") {
      setError("Please enter your UB email address");
      setLoading(false);
      return;
    }

    // Check if email is a UB email address
    if (!emailTrimmed.toLowerCase().endsWith("@buffalo.edu")) {
      setError("Only University at Buffalo email addresses are permitted (@buffalo.edu)");
      setLoading(false);
      return;
    }

    if (password.trim() === "") {
      setError("Please enter your password");
      setLoading(false);
      return;
    }

    try {
      // Call backend login API
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE}/auth/login.php`,
        {
          method: "POST",
          credentials: "include", // Important: allows cookies to be set
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );

      const data = await response.json();

      if (data.ok) {
        // Auth token is now set server-side as httpOnly cookie
        
        // Apply theme immediately after successful login
        if (data.theme) {
          if (data.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          
          // Also save to localStorage for immediate access
          try {
            const meRes = await fetch(`${process.env.REACT_APP_API_BASE}/auth/me.php`, { 
              method: 'GET', 
              credentials: 'include' 
            });
            if (meRes.ok) {
              const meJson = await meRes.json();
              const userId = meJson.user_id;
              if (userId) {
                const userThemeKey = `userTheme_${userId}`;
                localStorage.setItem(userThemeKey, data.theme);
              }
            }
          } catch (e) {
            // User not authenticated or error - continue anyway
          }
        }
        
        // Navigate to the main app
        navigate("/app");
      } else {
        // Show error from backend, with improved messaging
        const backendError = data.error || "Login failed";
        let userFriendlyError = backendError;
        
        // Map backend errors to more user-friendly messages
        if (backendError === "Invalid input format") {
          userFriendlyError = "Only University at Buffalo email addresses are permitted (@buffalo.edu)";
        } else if (backendError === "Email must be @buffalo.edu") {
          userFriendlyError = "Only University at Buffalo email addresses are permitted (@buffalo.edu)";
        } else if (backendError === "Invalid credentials") {
          userFriendlyError = "Invalid email or password. Please try again.";
        } else if (backendError.includes("too large")) {
          userFriendlyError = "Email or password is too long. Please check your input.";
        }
        
        setError(userFriendlyError);
      }
    } catch (error) {
      // Handle network or other errors
      setError("Network error. Please try again.");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      {/* Right side - Login form (full width on mobile, 50% on desktop) */}
      <div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 h-screen pre-login-bg relative overflow-hidden"
      >
        {/* Mobile branding header (visible only on mobile) */}
        <div className="md:hidden mb-4 sm:mb-6 text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl font-serif text-gray-800 mb-2">Dorm Mart</h1>
          <h2 className="text-lg sm:text-xl font-light text-gray-600 opacity-90">
            Wastage, who?
          </h2>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div
            className="p-4 sm:p-6 md:p-8 rounded-lg relative bg-blue-600"
          >
            {/* Torn paper effect */}
            <div
              className="absolute inset-0 rounded-lg bg-blue-600"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)",
              }}
            ></div>

            <div className="relative z-10">
              {/* Header with dot */}
              <div className="text-center mb-4 sm:mb-6 md:mb-8">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-black rounded-full mx-auto mb-3 sm:mb-4"></div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-white">
                  Log In
                </h2>
              </div>

              {/* Success message display */}
              {success && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                  <p className="text-sm">{success}</p>
                </div>
              )}

              {/* Error message display */}
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Login form */}
              <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4 md:space-y-6">
                {/* Email input */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                    University Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={50}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                  />
                </div>

                {/* Password input */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={64}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                  />
                </div>

                {/* Login button with arrow */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-3/4 md:w-1/2 lg:w-1/3 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed text-white py-2.5 sm:py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium mx-auto disabled:hover:scale-100 text-sm sm:text-base"
                >
                  <span>{loading ? "Logging in..." : "Login"}</span>
                  {!loading && (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </form>

              {/* Links */}
              <div className="mt-4 sm:mt-6 text-center">
                <div className="flex items-center justify-center space-x-2 text-sm sm:text-base text-white">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/create-account");
                    }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    create account
                  </a>
                  <span className="w-1 h-1 bg-black rounded-full"></span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/forgot-password");
                    }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    forgot password?
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
