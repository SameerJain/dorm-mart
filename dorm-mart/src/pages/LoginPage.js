import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetch_me } from "../utils/handle_auth.js";
import { apiPost, apiGet } from "../utils/api";
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

  // Redirect authenticated users - they must sign in again
  useEffect(() => {
    const controller = new AbortController();
    
    const checkAuth = async () => {
      try {
        await fetch_me(controller.signal);
        // User is authenticated - call logout API then redirect to login
        try {
          await apiPost('auth/logout.php', {});
        } catch (e) {
          // Ignore logout errors, just redirect
        }
        navigate("/login", { replace: true });
      } catch (error) {
        // Not authenticated - stay on login page
        if (error.name === 'AbortError') {
          return;
        }
      }
    };

    checkAuth();
    
    return () => {
      controller.abort();
    };
  }, [navigate]);

  // Handle URL parameters
  useEffect(() => {
    const urlError = searchParams.get("error");
    const urlMessage = searchParams.get("message");

    if (urlError === "reset_link_expired") {
      setError("Password reset link has expired. Please request a new one.");
    } else if (urlError === "invalid_reset_link") {
      setError(
        "Invalid password reset link. Please use the link from your email."
      );
    }

    if (urlMessage === "password_reset_success") {
      setSuccess(
        "Password has been reset successfully. You can now log in with your new password."
      );
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setLoading(true);

    // Validate input lengths FIRST (prevent excessively large inputs)
    if (email.length > 255 || password.length > 64) {
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
      /vbscript:/i,
    ];

    const emailTrimmed = email.trim();
    if (xssPatterns.some((pattern) => pattern.test(emailTrimmed))) {
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
      setError(
        "Only University at Buffalo email addresses are permitted (@buffalo.edu)"
      );
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
      const data = await apiPost('auth/login.php', {
        email: email.trim(),
        password: password,
      });

      console.log('Login API response:', data); // Debug logging

      if (data.success) {
        // Auth token is now set server-side as httpOnly cookie

        // Apply theme immediately after successful login
        if (data.theme) {
          if (data.theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }

          // Also save to localStorage for immediate access
          try {
            const meJson = await apiGet('auth/me.php');
            const userId = meJson.user_id;
            if (userId) {
              const userThemeKey = `userTheme_${userId}`;
              localStorage.setItem(userThemeKey, data.theme);
            }
          } catch (e) {
            // User not authenticated or error - continue anyway
          }
        }

        // Navigate to the main app
        navigate("/app");
      } else {
        // Show error from backend, with improved messaging
        console.error('Login failed - backend response:', data);
        const backendError = data.error || "Login failed";
        let userFriendlyError = backendError;

        // Map backend errors to more user-friendly messages
        if (backendError === "Invalid input format") {
          userFriendlyError =
            "Only University at Buffalo email addresses are permitted (@buffalo.edu)";
        } else if (backendError === "Email must be @buffalo.edu") {
          userFriendlyError =
            "Only University at Buffalo email addresses are permitted (@buffalo.edu)";
        } else if (backendError === "Invalid credentials") {
          userFriendlyError = "Invalid email or password. Please try again.";
        } else if (backendError.includes("too large")) {
          userFriendlyError =
            "Email or password is too long. Please check your input.";
        }

        setError(userFriendlyError);
      }
    } catch (error) {
      // Handle network or other errors
      console.error('Login error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Check if it's a network error or API error
      if (error.message) {
        setError(error.message);
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      {/* Right side - Login form (full width on mobile, 50% on desktop) */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-start md:justify-center p-4 sm:p-6 md:p-8 pt-20 sm:pt-24 md:py-8 pb-8 sm:pb-12 md:pb-8 h-screen pre-login-bg relative overflow-y-auto md:overflow-hidden">
        {/* Mobile branding header (visible only on mobile/tablet) */}
        <div className="md:hidden mb-6 sm:mb-8 text-center relative z-10">
          <h1 className="text-5xl sm:text-6xl font-serif text-gray-800 mb-3 leading-tight">
            Dorm Mart
          </h1>
          <h2 className="text-xl sm:text-2xl font-light text-gray-600 opacity-90 leading-relaxed">
            Wastage, who?
          </h2>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="p-4 sm:p-6 md:p-8 rounded-lg relative bg-blue-600">
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
                <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-black rounded-full mx-auto mb-3 sm:mb-4"></div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-white leading-tight">
                  Log In
                </h2>
              </div>

              {/* Success message display */}
              {success && (
                <div className="mb-4 p-3 sm:p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                  <p className="text-sm sm:text-base leading-relaxed">
                    {success}
                  </p>
                </div>
              )}

              {/* Error message display */}
              {error && (
                <div className="mb-4 p-3 sm:p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  <p className="text-sm sm:text-base leading-relaxed">
                    {error}
                  </p>
                </div>
              )}

              {/* Login form - Improved spacing for mobile */}
              <form
                onSubmit={handleLogin}
                noValidate
                className="space-y-3 sm:space-y-4 md:space-y-5"
              >
                {/* Email input */}
                <div>
                  <label className="block text-sm sm:text-base font-semibold text-gray-300 mb-2 sm:mb-2.5">
                    University Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Ensure we capture the full value up to 255 characters
                      if (value.length <= 255) {
                        setEmail(value);
                      } else {
                        setEmail(value.slice(0, 255));
                      }
                    }}
                    onPaste={(e) => {
                      // Always handle paste ourselves to ensure full email is captured
                      e.preventDefault();
                      const pastedText = (
                        e.clipboardData || window.clipboardData
                      ).getData("text");
                      let cleanedText = pastedText.trim();
                      // Remove '-- ' prefix if present (SQL comment marker)
                      if (cleanedText.startsWith("-- ")) {
                        cleanedText = cleanedText.substring(3).trim();
                      }
                      // Limit to exactly 255 characters to match database limit
                      const trimmedText = cleanedText.slice(0, 255);
                      setEmail(trimmedText);
                    }}
                    maxLength={255}
                    className="w-full min-h-[44px] px-4 sm:px-5 py-3 sm:py-3.5 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg"
                  />
                </div>

                {/* Password input */}
                <div>
                  <label className="block text-sm sm:text-base font-semibold text-gray-300 mb-2 sm:mb-2.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={64}
                    className="w-full min-h-[44px] px-4 sm:px-5 py-3 sm:py-3.5 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-base sm:text-lg"
                  />
                </div>

                {/* Login button with arrow - Minimum 44px height for touch targets */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed text-white py-3 sm:py-3.5 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium disabled:hover:scale-100 text-base sm:text-lg active:scale-95"
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

              {/* Links - Improved touch targets and spacing */}
              <div className="mt-6 sm:mt-8 text-center">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:text-base text-white">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/create-account");
                    }}
                    className="min-h-[44px] flex items-center px-2 py-2 hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    Create Account
                  </a>
                  <span className="w-1 h-1 bg-black rounded-full"></span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/forgot-password");
                    }}
                    className="min-h-[44px] flex items-center px-2 py-2 hover:underline hover:text-blue-400 transition-colors duration-200"
                  >
                    Forgot Password?
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Tagline - Mobile only, outside login card */}
          <p className="md:hidden mt-6 sm:mt-8 text-base sm:text-lg text-gray-600 opacity-80 max-w-sm mx-auto leading-relaxed text-center px-4">
            Your campus marketplace for buying and selling. Connect with fellow
            students and save money.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
