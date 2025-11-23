import { useNavigate } from "react-router-dom";
import { useState } from "react";
import backgroundImage from "../assets/images/login-page-left-side-background.jpg";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const BACKDOOR_KEYWORD = "testflow"; // typing this as the email triggers the confirmation page for testing

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
      const data = await sendForgotPasswordRequest(email, ac.signal);

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
    const pattern = /^[A-Za-z0-9]{1,15}@buffalo\.edu$/i;
    const trimmed = email.trim();

    // Must match pattern first
    if (!pattern.test(trimmed)) return false;

    // Extract part before @
    const localPart = trimmed.split("@")[0];

    // Reject if only numbers
    if (/^\d+$/.test(localPart)) return false;

    return true;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Left side - Background image with branding (hidden on mobile, 50% on desktop) */}
      <div className="hidden md:block md:w-1/2 relative min-h-screen">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImage})`,
          }}
        ></div>

        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>

        {/* Branding content */}
        <div className="relative z-10 h-full flex flex-col justify-center items-center p-4 lg:p-8">
          <div className="text-center w-full px-4">
            <h1 className="text-6xl lg:text-8xl xl:text-9xl font-serif text-white mb-4 lg:mb-6 flex items-center justify-center space-x-2 lg:space-x-6 overflow-hidden">
              <span className="whitespace-nowrap">Dorm</span>
              <span className="whitespace-nowrap">Mart</span>
            </h1>
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-light text-white opacity-90">
              Wastage Who?
            </h2>
          </div>
        </div>
      </div>

      {/* Right side - forgot password form (full width on mobile, 50% on desktop) */}
      <div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 min-h-screen"
        style={{ backgroundColor: "#364156" }}
      >
        {/* Mobile branding header (visible only on mobile) */}
        <div className="md:hidden mb-4 sm:mb-6 text-center">
          <h1 className="text-3xl xs:text-4xl sm:text-5xl font-serif text-white mb-2">
            Dorm Mart
          </h1>
          <h2 className="text-base xs:text-lg sm:text-xl font-light text-white opacity-90">
            Wastage Who?
          </h2>
        </div>
        <div className="w-full max-w-md px-2 sm:px-0">
          <div
            className="p-6 sm:p-8 rounded-lg relative"
            style={{ backgroundColor: "#3d3eb5" }}
          >
            {/* Torn paper effect */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                backgroundColor: "#3d3eb5",
                clipPath:
                  "polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)",
              }}
            ></div>

            <div className="relative z-10">
              {/* Header with dot */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-3 h-3 bg-black rounded-full mx-auto mb-4"></div>
                <h2 className="text-2xl xs:text-3xl sm:text-4xl font-serif text-white">
                  Forgot Password?{" "}
                </h2>
              </div>

              {/* forgot password form */}
              <form
                onSubmit={handleForgotPasswordRequest}
                noValidate
                className="space-y-4 sm:space-y-6"
              >
                {/* email input input */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-300 mb-2">
                    University Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={30}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                    placeholder="ubname@buffalo.edu"
                  />
                </div>
                {error && (
                  <p className="text-xs sm:text-sm font-medium text-center text-red-500 px-2">
                    {error}
                  </p>
                )}

                {/* request button with arrow */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full max-w-sm bg-blue-500 hover:bg-blue-600 text-white py-2.5 sm:py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium mx-auto text-sm sm:text-base"
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
                        className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
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

              {/* Links */}
              <div className="mt-4 sm:mt-6 text-center px-2">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-sm md:text-base text-white">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/create-account");
                    }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200 whitespace-nowrap bg-transparent border-none text-white cursor-pointer p-0"
                  >
                    Create account
                  </button>
                  <span className="w-1 h-1 bg-black rounded-full hidden xs:block"></span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/login");
                    }}
                    className="hover:underline hover:text-blue-400 transition-colors duration-200 whitespace-nowrap bg-transparent border-none text-white cursor-pointer p-0"
                  >
                    Go back to login
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
