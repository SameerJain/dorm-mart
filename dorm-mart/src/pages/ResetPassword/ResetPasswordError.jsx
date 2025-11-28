import { useNavigate } from "react-router-dom";
import PreLoginBranding from "../../components/PreLoginBranding";

function ResetPasswordError({ errorType = "expired" }) {
  const navigate = useNavigate();

  const getErrorContent = () => {
    switch (errorType) {
      case "expired":
        return {
          title: "Reset Link Expired",
          message: "This password reset link has expired. Please request a new one.",
          icon: "⏰"
        };
      case "invalid":
        return {
          title: "Invalid Reset Link", 
          message: "This password reset link is invalid. Please use the link from your email.",
          icon: "❌"
        };
      default:
        return {
          title: "Reset Link Error",
          message: "There was an issue with your password reset link. Please try again.",
          icon: "⚠️"
        };
    }
  };

  const { title, message, icon } = getErrorContent();

  return (
    <div className="h-screen flex flex-col md:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      {/* Right side - Error message (full width on mobile, 50% on desktop) */}
      <div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 h-screen pre-login-bg relative overflow-hidden"
      >
        {/* Mobile branding header (visible only on mobile) */}
        <div className="md:hidden mb-4 sm:mb-6 text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl font-serif text-gray-800 mb-2">
            Dorm Mart
          </h1>
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

            <div className="relative z-10 text-center">
              {/* Header with dot */}
              <div className="mb-4 sm:mb-6 md:mb-8">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-black rounded-full mx-auto mb-3 sm:mb-4"></div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-white mb-4">
                  {title}
                </h2>
              </div>

              {/* Error Icon */}
              <div className="text-6xl mb-6">{icon}</div>
              
              {/* Error Message */}
              <p className="text-sm sm:text-base text-white/90 mb-6 leading-relaxed">{message}</p>
              
              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/forgot-password')}
                  className="w-full px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium"
                >
                  Request New Reset Link
                </button>
                
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordError;

