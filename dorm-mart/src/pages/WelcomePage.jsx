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
    { icon: '💰', title: 'Save Money', description: 'Great campus deals' },
    { icon: '🌱', title: 'Go Green', description: 'Reduce, reuse' },
    { icon: '🤝', title: 'Trusted', description: 'Secure platform' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <PreLoginBranding animate={true} />

      {/* Right side - Action buttons (full width on mobile, 50% on desktop) */}
      <div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen pre-login-bg relative"
      >
        {/* Mobile branding header (visible only on mobile) */}
        <div className="md:hidden mb-6 text-center relative z-10">
          <h1 className="text-5xl font-serif text-gray-800 mb-2">Dorm Mart</h1>
          <h2 className="text-xl font-light text-gray-600 opacity-90">
            Wastage Who?
          </h2>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div
            className="p-4 sm:p-8 rounded-lg relative bg-blue-600"
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
              <div className="text-center mb-6 sm:mb-8">
                <div className="w-3 h-3 bg-black rounded-full mx-auto mb-4"></div>
                <h2 className="text-3xl sm:text-4xl font-serif text-white mb-3">
                  Welcome!
                </h2>
                <p className="text-base text-gray-200 mb-2">
                  Join the campus marketplace
                </p>
                <p className="text-sm text-gray-300 opacity-90">
                  Buy, sell, and trade with UB students
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-4 sm:space-y-5 mb-6">
                {/* Login Button */}
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-4 py-3 sm:py-4 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-semibold text-base sm:text-lg transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
                >
                  Log In
                </button>

                {/* Create Account Button */}
                <button
                  onClick={() => navigate('/create-account')}
                  className="w-full px-4 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold text-base sm:text-lg transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/30"
                >
                  Create Account
                </button>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 hover:bg-white/15 transition-all duration-200"
                  >
                    <div className="text-2xl mb-1">
                      {feature.icon}
                    </div>
                    <h3 className="text-xs font-semibold text-white mb-0.5">{feature.title}</h3>
                    <p className="text-xs text-gray-300">{feature.description}</p>
                  </div>
                ))}
              </div>

              {/* Additional info */}
              <div className="text-center pt-2">
                <p className="text-sm text-gray-300">
                  🎓 Exclusively for UB students
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Secure • Fast • Sustainable
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomePage;
