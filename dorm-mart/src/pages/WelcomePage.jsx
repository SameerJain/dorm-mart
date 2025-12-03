import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { fetch_me } from '../utils/handle_auth.js';
import PreLoginBranding from '../components/PreLoginBranding';

function WelcomePage() {
  const navigate = useNavigate();

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
        // User is not authenticated, stay on welcome page
      }
    };

    checkAuth();
    
    // Cleanup: abort fetch if component unmounts
    return () => {
      controller.abort();
    };
  }, [navigate]);

  const features = [
    { icon: '🛍️', title: 'Buy & Sell', description: 'Trade with students' },
    { icon: '💰', title: 'Spend less', description: 'Great campus deals' },
    { icon: '🌱', title: 'Go Green', description: 'Reduce, reuse' },
    { icon: '🤝', title: 'Trusted', description: 'Secure platform' },
  ];

  return (
    <div className="h-screen flex flex-col md:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding animate={true} animateText={true} />

      {/* Right side - Action buttons (full width on mobile, 50% on desktop) */}
      <div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 h-screen pre-login-bg relative overflow-hidden"
      >
        {/* Mobile branding header (visible only on mobile/tablet) */}
        <div className="md:hidden mb-6 sm:mb-8 text-center relative z-10">
          <h1 className="text-5xl sm:text-6xl font-serif text-gray-800 mb-3 leading-tight">Dorm Mart</h1>
          <h2 className="text-xl sm:text-2xl font-light text-gray-600 opacity-90 leading-relaxed">
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
              <div className="text-center mb-6 sm:mb-8 md:mb-10">
                <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-black rounded-full mx-auto mb-4 sm:mb-5"></div>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-white leading-tight">
                  Welcome!
                </h2>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="bg-white/5 rounded-lg p-3 sm:p-4"
                  >
                    <div className="text-2xl sm:text-3xl mb-1 sm:mb-1.5">
                      {feature.icon}
                    </div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white mb-1 leading-tight">{feature.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-4">
                {/* Login Button - Minimum 44px height for touch targets */}
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 min-h-[44px] px-5 py-3 sm:py-3.5 md:py-4 bg-sky-500 hover:bg-sky-600 rounded-lg text-white font-semibold text-base sm:text-lg md:text-lg transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-sky-400/30 active:scale-95"
                >
                  Log In
                </button>

                {/* Create Account Button - Minimum 44px height for touch targets */}
                <button
                  onClick={() => navigate('/create-account')}
                  className="flex-1 min-h-[44px] px-5 py-3 sm:py-3.5 md:py-4 bg-teal-400 hover:bg-teal-500 rounded-lg text-white font-semibold text-base sm:text-lg md:text-lg transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-teal-300/30 active:scale-95"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
