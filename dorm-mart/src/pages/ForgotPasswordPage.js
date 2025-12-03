import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { fetch_me } from "../utils/handle_auth.js";
import PreLoginBranding from "../components/PreLoginBranding";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const BACKDOOR_KEYWORD = "testflow"; // typing this as the email triggers the confirmation page for testing

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
        // User is not authenticated, stay on forgot password page
      }
    };

    checkAuth();
    
    // Cleanup: abort fetch if component unmounts
    return () => {
      controller.abort();
    };
  }, [navigate]);

  async function sendForgotPasswordRequest(email, signal) {
    const BASE = process.env.REACT_APP_API_BASE || "/api";
    const r = await fetch(`${BASE}/auth/forgot-password.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();

    // Clear any previous errors immediately
    setError("");

    // Testing backdoor: allow quick navigation to confirmation page
    if (email.trim().toLowerCase() === BACKDOOR_KEYWORD) {
      navigate("/forgot-password/confirmation");
      return;
    }

    const valid = emailValidation(email);
    if (!valid) {
      setError("Email must be a valid UB email address");
      return;
    }

    setIsLoading(true);

    try {
      const ac = new AbortController();
      await sendForgotPasswordRequest(email, ac.signal);

      // For valid UB emails, always show confirmation page for security
      // (whether email exists in DB, rate limited, or network error)
      setError("");

      setTimeout(() => {
        setIsLoading(false); // keep spinner during the delay
        navigate("/forgot-password/confirmation");
      }, 2000);
    } catch (err) {
      console.error(err);
      // For valid UB emails, always show confirmation page for security
      setError("");

      setTimeout(() => {
        setIsLoading(false); // keep spinner during the delay
        navigate("/forgot-password/confirmation");
      }, 2000);
    }
  };

  function emailValidation(email) {
    const pattern = /^[^@\s]+@buffalo\.edu$/i;
    const trimmed = email.trim();

    // Check length (255 characters max to match database limit)
    if (trimmed.length > 255) return false;

    // Must match pattern first
    if (!pattern.test(trimmed)) return false;

    // Extract part before @
    const localPart = trimmed.split("@")[0];

    // Reject if only numbers
    if (/^\d+$/.test(localPart)) return false;

    return true;
  }

  return (
    <div className="h-screen flex flex-col md:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      {/* Right side - forgot password form (full width on mobile, 50% on desktop) */}
      <div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 py-8 sm:py-12 md:py-8 h-screen pre-login-bg relative overflow-y-auto md:overflow-hidden"
      >
        {/* Mobile branding header (visible only on mobile/tablet) */}
        <div className="md:hidden mb-6 sm:mb-8 text-center relative z-10">
          <h1 className="text-5xl sm:text-6xl font-serif text-gray-800 mb-3 leading-tight">
            Dorm Mart
          </h1>
          <h2 className="text-xl sm:text-2xl font-light text-gray-600 opacity-90 leading-relaxed">
            Wastage, who?
          </h2>
        </div>
        <div className="w-full max-w-md px-2 sm:px-0 relative z-10">
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
              <div className="text-center mb-6 sm:mb-8 md:mb-10">
                <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-black rounded-full mx-auto mb-4 sm:mb-5"></div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-white leading-tight">
                  Forgot Password?{" "}
                </h2>
              </div>

              {/* forgot password form - Improved spacing and touch targets */}
              <form
                onSubmit={handleForgotPasswordRequest}
                noValidate
                className="space-y-4 sm:space-y-5 md:space-y-6"
              >
                {/* email input input */}
                <div>
                  <label className="block text-sm sm:text-base font-semibold text-gray-300 mb-2 sm:mb-2.5">
                    University Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    className="w-full min-h-[44px] px-4 sm:px-5 py-3 sm:py-3.5 text-base sm:text-lg bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                  />
                </div>
                {error && (
                  <p className="text-sm sm:text-base font-medium text-center text-red-500 px-2 leading-relaxed">
                    {error}
                  </p>
                )}

                {/* request button with arrow - Minimum 44px height for touch targets */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[44px] bg-sky-500 hover:bg-sky-600 text-white py-3 sm:py-3.5 px-5 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium text-base sm:text-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      ></path>
                    </svg>
                  ) : (
                    <>
                      <span className="whitespace-nowrap">
                        Send password reset link
                      </span>
                      <svg
                        className="w-5 h-5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Links - Improved touch targets and spacing */}
              <div className="mt-6 sm:mt-8 text-center px-2">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:text-base text-white">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/create-account");
                    }}
                    className="min-h-[44px] flex items-center px-2 py-2 hover:underline hover:text-blue-400 transition-colors duration-200 whitespace-nowrap bg-transparent border-none text-white cursor-pointer"
                  >
                    Create Account
                  </button>
                  <span className="w-1 h-1 bg-black rounded-full"></span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/login");
                    }}
                    className="min-h-[44px] flex items-center px-2 py-2 hover:underline hover:text-blue-400 transition-colors duration-200 whitespace-nowrap bg-transparent border-none text-white cursor-pointer"
                  >
                    Go To Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
