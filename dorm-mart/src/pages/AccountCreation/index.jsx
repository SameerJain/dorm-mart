import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import termsPdf from '../../assets/pdfs/terms&conditions.pdf';
import privacyPdf from '../../assets/pdfs/privacy.pdf';
import { fetch_me } from '../../utils/handle_auth.js';
import PreLoginBranding from '../../components/PreLoginBranding';

function CreateAccountPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gradMonth: "",
    gradYear: "",
    email: "",
    terms: false,
    promos: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

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
        // User is not authenticated, stay on create account page
      }
    };

    checkAuth();
    
    // Cleanup: abort fetch if component unmounts
    return () => {
      controller.abort();
    };
  }, [navigate]);

  // Prevent body scroll when email notice modal is open
  useEffect(() => {
    if (showNotice) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [showNotice]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Enforce hard caps at input-time
    let nextValue = type === "checkbox" ? checked : value;
    if (name === "firstName" || name === "lastName") {
      // Only allow letters (including spaces and hyphens for names like "Mary-Jane" or "Van Der Berg")
      // Remove any non-letter characters except spaces and hyphens
      nextValue = String(nextValue).replace(/[^a-zA-Z\s-]/g, '');
      nextValue = nextValue.slice(0, 30);
    }
    if (name === "email") {
      nextValue = String(nextValue).slice(0, 255);
    }
    if (name === "gradMonth") {
      nextValue = String(nextValue).slice(0, 2);
    }
    if (name === "gradYear") {
      nextValue = String(nextValue).slice(0, 4);
    }

    setFormData(prev => ({
      ...prev,
      [name]: nextValue
    }));
  };

  const validate = () => {
    const newErrors = {};

    const first = formData.firstName.trim();
    const last = formData.lastName.trim();
    const email = formData.email.trim();

    // XSS PROTECTION: Check for XSS patterns in firstName and lastName
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

    if (!first) newErrors.firstName = "First name is required";
    else if (xssPatterns.some(pattern => pattern.test(first))) {
      newErrors.firstName = "Invalid characters in first name";
    }
    else if (!/^[a-zA-Z\s-]+$/.test(first)) {
      newErrors.firstName = "First name can only contain letters, spaces, and hyphens";
    }
    else if (first.length > 30) newErrors.firstName = "First name must be 30 characters or fewer";

    if (!last) newErrors.lastName = "Last name is required";
    else if (xssPatterns.some(pattern => pattern.test(last))) {
      newErrors.lastName = "Invalid characters in last name";
    }
    else if (!/^[a-zA-Z\s-]+$/.test(last)) {
      newErrors.lastName = "Last name can only contain letters, spaces, and hyphens";
    }
    else if (last.length > 30) newErrors.lastName = "Last name must be 30 characters or fewer";

    if (!formData.gradMonth || !formData.gradYear) {
      newErrors.gradDate = "Graduation month and year are required";
    } else {
      const month = parseInt(formData.gradMonth, 10);
      const year = parseInt(formData.gradYear, 10);

      if (Number.isNaN(month) || month < 1 || month > 12) {
        newErrors.gradDate = "Invalid month";
      } else if (Number.isNaN(year) || year < 1900) {
        newErrors.gradDate = "Invalid year";
      } else {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const gradDate = new Date(year, month - 1, 1);
        const maxDate = new Date(now.getFullYear() + 8, now.getMonth(), 1);
        if (gradDate < new Date(now.getFullYear(), now.getMonth(), 1)) newErrors.gradDate = "Graduation date cannot be in the past";
        if (gradDate > maxDate) newErrors.gradDate = "Graduation date must be within 8 years";
      }
    }

    if (!email) {
      newErrors.email = "Email is required";
    } else if (email.length > 255) {
      newErrors.email = "Email must be 255 characters or fewer";
    } else if (!email.toLowerCase().endsWith("@buffalo.edu")) {
      newErrors.email = "Email must be a buffalo.edu address";
    }

    if (!formData.terms) newErrors.terms = "You must agree to the terms";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await fetch(`api/auth/create_account.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          gradMonth: formData.gradMonth,
          gradYear: formData.gradYear,
          email: formData.email.trim(),
          promos: formData.promos
        }),
      });
      setShowNotice(true);
    } catch {
      setShowNotice(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      {/* Right side - Create Account form (full width on mobile/tablet, 50% on desktop) */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-6 h-screen overflow-y-auto md:overflow-hidden pre-login-bg relative">
        {/* Mobile branding header (visible only on mobile/tablet) */}
        <div className="md:hidden mb-4 sm:mb-6 text-center w-full relative z-10">
          <h1 className="text-4xl sm:text-5xl font-serif text-gray-800 mb-2">
            Dorm Mart
          </h1>
          <h2 className="text-lg sm:text-xl font-light text-gray-600 opacity-90">Wastage, who?</h2>
        </div>
        <div className="w-full max-w-md relative z-10">
          <div className="p-4 sm:p-6 md:p-8 lg:p-6 rounded-lg relative bg-blue-600">
            {/* Torn paper effect */}
            <div
              className="absolute inset-0 rounded-lg bg-blue-600"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)'
              }}
            />

            <div className="relative z-10">
              {/* Header with dot */}
              <div className="text-center mb-4 sm:mb-6 md:mb-8">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-black rounded-full mx-auto mb-3 sm:mb-4" />
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-white">Create Account</h2>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5 md:space-y-4">
                {/* First Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 sm:mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    maxLength={30}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                  />
                  {errors.firstName && <p className="text-xs font-medium text-red-500 mt-0.5 leading-tight">{errors.firstName}</p>}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 sm:mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    maxLength={30}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                  />
                  {errors.lastName && <p className="text-xs font-medium text-red-500 mt-0.5 leading-tight">{errors.lastName}</p>}
                </div>

                {/* Graduation Date */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 sm:mb-2">Graduation Date (Month / Year)</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      name="gradMonth"
                      value={formData.gradMonth}
                      onChange={handleChange}
                      placeholder="MM"
                      maxLength={2}
                      className="w-1/2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                    />
                    <input
                      type="number"
                      name="gradYear"
                      value={formData.gradYear}
                      onChange={handleChange}
                      placeholder="YYYY"
                      maxLength={4}
                      className="w-1/2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                    />
                  </div>
                  {errors.gradDate && <p className="text-xs font-medium text-red-500 mt-0.5 leading-tight">{errors.gradDate}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-200 mb-1.5 sm:mb-2">University Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    maxLength={255}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-400/30 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg text-sm sm:text-base"
                  />
                  {errors.email && <p className="text-xs font-medium text-red-500 mt-0.5 leading-tight">{errors.email}</p>}
                </div>

                {/* Checkboxes */}
                <div className="space-y-2">
                  <label className="flex items-center text-gray-100">
                    <input
                      type="checkbox"
                      name="terms"
                      checked={formData.terms}
                      onChange={handleChange}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="select-none">
                      I agree to the{" "}
                      <a
                        href={termsPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-white/70 hover:decoration-white hover:text-blue-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms & Conditions
                      </a>{" "}
                      and{" "}
                      <a
                        href={privacyPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-white/70 hover:decoration-white hover:text-blue-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                  {errors.terms && <p className="text-xs font-medium text-red-500 mt-0.5 leading-tight">{errors.terms}</p>}

                  <label className="flex items-center text-gray-100">
                    <input
                      type="checkbox"
                      name="promos"
                      checked={formData.promos}
                      onChange={handleChange}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    I want to receive promotional news on my email
                  </label>
                </div>

                {/* Confirm button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full sm:w-3/4 md:w-1/2 lg:w-1/3 text-white py-2.5 sm:py-3 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 font-medium mx-auto text-sm sm:text-base
                    ${loading ? 'bg-sky-300 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-600 hover:scale-105 hover:shadow-lg'}
                  `}
                >
                  <span>{loading ? 'Submitting…' : 'Confirm'}</span>
                  {!loading && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
              <div className="mt-3 sm:mt-4 md:mt-6 mb-3 sm:mb-4 md:mb-8 text-center">
                <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm md:text-base text-white">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); navigate('/login'); }}
                    className="hover:underline hover:text-blue-300 transition-colors duration-200"
                  >
                    already have an account? log in
                  </a>
                  <span className="w-1 h-1 bg-black rounded-full" />
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}
                    className="hover:underline hover:text-blue-300 transition-colors duration-200"
                  >
                    forgot password?
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Modal */}
      {showNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowNotice(false)}
          />
          {/* card */}
          <div className="relative z-10 w-full max-w-lg mx-4 rounded-xl shadow-2xl border border-white/10 bg-blue-600">
            <div className="p-6">
              <h3 className="text-2xl font-serif text-white mb-3 text-center">Check Your Email</h3>
              <p className="text-white/90 text-center leading-relaxed">
                If an account using the email does not already exist, a temporary password has been sent to the email.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => { setShowNotice(false); navigate('/login'); }}
                  className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors"
                >
                  Go to Login
                </button>
                <button
                  onClick={() => setShowNotice(false)}
                  className="px-5 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateAccountPage;
