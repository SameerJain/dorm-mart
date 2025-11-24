import { useNavigate } from 'react-router-dom';
import PreLoginBranding from '../../components/PreLoginBranding';

function ForgotPasswordConfirmation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <PreLoginBranding />

      {/* Right side - Confirmation message (full width on mobile, 50% on desktop) */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen pre-login-bg relative">
        {/* Mobile branding header (visible only on mobile) */}
        <div className="md:hidden mb-6 text-center relative z-10">
          <h1 className="text-5xl font-serif text-gray-800 mb-2">Dorm Mart</h1>
          <h2 className="text-xl font-light text-gray-600 opacity-90">
            Wastage Who?
          </h2>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="p-4 sm:p-8 rounded-lg relative bg-blue-600">
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
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-3 h-3 bg-black rounded-full mx-auto mb-4"></div>
                <h2 className="text-3xl sm:text-4xl font-serif text-white">
                  Check Your Email
                </h2>
              </div>

              <p className="text-base text-gray-200 mb-4 text-center leading-relaxed">
                If an account with this email address exists, then a link to reset your password was sent to your inbox!
              </p>
              <p className="text-sm text-gray-300 text-center italic mb-6">
                Note: Another email can only be sent after 10 minutes.
              </p>

              {/* Button */}
              <button
                onClick={() => { navigate('/login'); }}
                className="w-full sm:w-1/2 md:w-1/3 bg-blue-500 hover:bg-blue-600 text-white py-2 sm:py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium mx-auto"
              >
                <span>Go to Login</span>
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
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordConfirmation;


