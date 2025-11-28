import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import PreLoginBranding from "../../components/PreLoginBranding";

const NAV_BLUE = "#2563EB";
const MAX_LEN = 64;

const hasLower = (s) => /[a-z]/.test(s);
const hasUpper = (s) => /[A-Z]/.test(s);
const hasDigit = (s) => /\d/.test(s);
const hasSpecial = (s) => /[^A-Za-z0-9]/.test(s);

function RequirementRow({ ok, text }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ok ? "#22c55e" : "#ef4444" }} />
      <span className={ok ? "text-green-200" : "text-red-200"}>{text}</span>
    </div>
  );
}

function Field({ id, label, type = "password", value, onChange, placeholder, disabled = false }) {
  return (
    <div className="mb-6">
      <label htmlFor={id} className="mb-2 block text-xs sm:text-sm font-semibold text-gray-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        disabled={disabled}
        className={`h-11 w-full rounded-lg border-2 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base outline-none focus:ring-4 transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg ${disabled
            ? 'border-gray-400 bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'border-gray-300 bg-white focus:ring-blue-400/30 focus:border-blue-400'
          }`}
      />
    </div>
  );
}

function ResetPasswordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Token validation state
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);

  // Error handling state
  const [submitError, setSubmitError] = useState("");
  const [passwordMismatchError, setPasswordMismatchError] = useState("");

  const policy = useMemo(
    () => ({
      minLen: newPassword.length >= 8,
      lower: hasLower(newPassword),
      upper: hasUpper(newPassword),
      digit: hasDigit(newPassword),
      special: hasSpecial(newPassword),
      notTooLong: newPassword.length <= MAX_LEN,
    }),
    [newPassword]
  );

  const enforceMax = (setter) => (e) => {
    const v = e.target.value;
    if (v.length > MAX_LEN) alert("Entered password is too long. Maximum length is 64 characters.");
    setter(v);
  };

  // Check if user already completed password reset for this specific token
  useEffect(() => {
    // Handle missing token
    if (!token) {
      navigate('/login?error=invalid_reset_link', { replace: true });
      return;
    }

    // Validate token with backend
    const validateToken = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE}/auth/validate-reset-token.php?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        
        if (data.success && data.valid) {
          setIsTokenValid(true);
        } else {
          setIsTokenValid(false);
          setTokenError(data.message || 'Invalid or expired reset token');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setIsTokenValid(false);
        setTokenError('Failed to validate reset token');
      } finally {
        setIsVerifyingToken(false);
      }
    };

    validateToken();
  }, [token, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleSubmit = async () => {
    // Clear previous errors
    setSubmitError("");
    setPasswordMismatchError("");

    // Validate form inputs
    if (!newPassword || !confirmPassword) {
      setSubmitError("Please fill in all required fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMismatchError("The passwords do not match. Please try again.");
      return;
    }

    if (newPassword.length > MAX_LEN || confirmPassword.length > MAX_LEN) {
      setSubmitError("Password is too long. Maximum length is 64 characters.");
      return;
    }

    if (newPassword.length < 8) {
      setSubmitError("Password must have at least 8 characters.");
      return;
    }

    if (!hasLower(newPassword)) {
      setSubmitError("Password must have at least 1 lowercase letter.");
      return;
    }

    if (!hasUpper(newPassword)) {
      setSubmitError("Password must have at least 1 uppercase letter.");
      return;
    }

    if (!hasDigit(newPassword)) {
      setSubmitError("Password must have at least 1 digit.");
      return;
    }

    if (!hasSpecial(newPassword)) {
      setSubmitError("Password must have at least 1 special character.");
      return;
    }

    // Set loading state
    setIsLoading(true);

    try {
      // Call the reset password API
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/auth/reset-password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        // Password reset successful - redirect to login
        navigate('/login?message=password_reset_success', { replace: true });
      } else {
        // Handle API errors
        setSubmitError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row pre-login-bg overflow-hidden">
      <PreLoginBranding />

      {/* Right side - Reset password form (full width on mobile, 50% on desktop) */}
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

        <div className="w-full max-w-4xl relative z-10 overflow-y-auto">
          <div
            className="p-4 sm:p-6 md:p-8 rounded-lg relative bg-blue-600 min-h-[600px] flex flex-col"
          >
            {/* Torn paper effect */}
            <div
              className="absolute inset-0 rounded-lg bg-blue-600"
              style={{
                clipPath:
                  "polygon(0 0, 100% 0, 100% 85%, 95% 90%, 100% 95%, 100% 100%, 0 100%)",
              }}
            ></div>

            <div className="relative z-10 flex-1 flex flex-col">
              {/* Header with dot */}
              <div className="mb-6 border-b border-white/20 pb-3">
                <div className="text-center">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-black rounded-full mx-auto mb-2"></div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-white">
                    Reset Password
                  </h1>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-2">
                <section className="flex flex-col justify-center">
                  {isVerifyingToken && (
                    <div className="mb-6 p-4 bg-white/10 border border-white/20 rounded-lg">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-white">Verifying reset link...</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isTokenValid && !isVerifyingToken && (
                    <div className="mb-6 p-4 bg-red-500/30 border-2 border-red-500 rounded-lg">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-600">Reset Link Expired</h3>
                          <p className="mt-1 text-sm text-red-600">{tokenError}</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => navigate('/forgot-password')}
                          className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md transition-colors"
                        >
                          Request New Reset Link
                        </button>
                        <button
                          onClick={() => navigate('/login')}
                          className="ml-3 text-sm bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-md transition-colors"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Test 1: Invalid token error */}
                  {submitError && (
                    <div className="mb-6 p-4 bg-red-500/30 border-2 border-red-500 rounded-lg">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-600">{submitError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test 3: Password mismatch error */}
                  {passwordMismatchError && (
                    <div className="mb-6 p-4 bg-yellow-100/20 border border-yellow-300/30 rounded-lg">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-white">{passwordMismatchError}</p>
                        </div>
                      </div>
                    </div>
                  )}

              <Field
                id="newPassword"
                label="New Password"
                value={newPassword}
                onChange={enforceMax(setNewPassword)}
                placeholder="Enter new password"
                disabled={!isTokenValid || isVerifyingToken}
              />
              <Field
                id="confirmPassword"
                label="Re-enter New Password"
                value={confirmPassword}
                onChange={enforceMax(setConfirmPassword)}
                placeholder="Re-enter new password"
                disabled={!isTokenValid || isVerifyingToken}
              />

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || !isTokenValid || isVerifyingToken}
                    className="mt-6 h-12 w-full sm:w-48 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium disabled:hover:scale-100 text-sm sm:text-base"
                  >
                    {isLoading ? 'Resetting...' : isVerifyingToken ? 'Verifying...' : 'Reset Password'}
                  </button>
                </section>

                <section className="rounded-lg border border-white/20 bg-white/10 p-4 sm:p-6 flex flex-col justify-center">
                  <h2 className="mb-4 text-lg sm:text-xl font-serif font-semibold text-white">
                    Password Requirements:
                  </h2>
                  <div className="flex flex-col gap-3">
                    <RequirementRow ok={policy.lower} text="At least 1 lowercase character" />
                    <RequirementRow ok={policy.upper} text="At least 1 uppercase character" />
                    <RequirementRow ok={policy.minLen} text="At least 8 characters" />
                    <RequirementRow ok={policy.special} text="At least 1 special character" />
                    <RequirementRow ok={policy.digit} text="At least 1 digit" />
                    <RequirementRow ok={policy.notTooLong} text="No more than 64 characters" />
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordForm;