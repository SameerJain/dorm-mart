import backgroundImage from '../assets/images/cf704b7b8689fdfa8cf49a9f368bb17c.jpg';

function PreLoginBranding({ animate = false, animateText = false }) {
  return (
    <>
      {/* Left side - Background image with branding (hidden on mobile, 50% on desktop) */}
      <div className="hidden md:block md:w-1/2 relative h-[calc(100vh-2rem)] rounded-[3rem] md:rounded-[4rem] lg:rounded-[5rem] overflow-hidden border-4 border-white/40 shadow-2xl my-4 mx-2 md:mx-4">
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
            <h1 className={`text-6xl lg:text-8xl xl:text-9xl font-serif text-white mb-4 lg:mb-6 flex flex-col lg:flex-row items-center justify-center lg:space-x-6 leading-tight lg:leading-normal ${animateText ? 'animate-fade-in' : ''}`}>
              <span>Dorm</span>
              <span>Mart</span>
            </h1>
            <h2 className={`text-2xl lg:text-3xl xl:text-4xl font-light text-white opacity-90 ${animateText ? 'animate-fade-in-delay' : ''}`}>
              Wastage, who?
            </h2>
            <p className={`text-lg lg:text-xl text-white opacity-95 mt-6 lg:mt-8 max-w-md mx-auto ${animateText ? 'animate-fade-in-delay-2' : ''}`}>
              Your campus marketplace for buying and selling. Connect with fellow students and save money.
            </p>
          </div>
        </div>
      </div>

      {/* Animation styles */}
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
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in 0.8s ease-out 0.2s both;
        }
        
        .animate-fade-in-delay-2 {
          animation: fade-in 0.8s ease-out 0.4s both;
        }
      `}</style>
    </>
  );
}

export default PreLoginBranding;

