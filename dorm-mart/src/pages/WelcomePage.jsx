import { useNavigate } from 'react-router-dom';
import backgroundImage from '../assets/images/login-page-left-side-background.jpg';

function WelcomePage() {
  const navigate = useNavigate();

  const features = [
    { icon: '🛍️', title: 'Buy & Sell', description: 'Trade with students' },
    { icon: '💰', title: 'Save Money', description: 'Great campus deals' },
    { icon: '🌱', title: 'Go Green', description: 'Reduce, reuse' },
    { icon: '🤝', title: 'Trusted', description: 'Secure platform' },
  ];

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
            {/* Shopping cart icon */}
            <div className="text-7xl mb-6 animate-bounce-slow">
              🛒
            </div>
            
            <h1 className="text-6xl lg:text-8xl xl:text-9xl font-serif text-white mb-4 lg:mb-6 flex flex-col lg:flex-row items-center justify-center lg:space-x-6 leading-tight lg:leading-normal animate-fade-in">
              <span>Dorm</span>
              <span>Mart</span>
            </h1>
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-light text-white opacity-90 animate-fade-in-delay">
              Wastage Who?
            </h2>
            <p className="text-lg lg:text-xl text-white opacity-80 mt-6 lg:mt-8 max-w-md mx-auto animate-fade-in-delay-2">
              Your campus marketplace for buying and selling. Connect with fellow students and give items a second life.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Action buttons (full width on mobile, 50% on desktop) */}
      <div
        className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen"
        style={{ backgroundColor: "#364156" }}
      >
        {/* Mobile branding header (visible only on mobile) */}
        <div className="md:hidden mb-6 text-center">
          <h1 className="text-5xl font-serif text-white mb-2">Dorm Mart</h1>
          <h2 className="text-xl font-light text-white opacity-90">
            Wastage Who?
          </h2>
        </div>

        <div className="w-full max-w-md">
          <div
            className="p-4 sm:p-8 rounded-lg relative"
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

      {/* Add custom animations via style tag */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-15px);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in 0.8s ease-out 0.2s both;
        }
        
        .animate-fade-in-delay-2 {
          animation: fade-in 0.8s ease-out 0.4s both;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default WelcomePage;
