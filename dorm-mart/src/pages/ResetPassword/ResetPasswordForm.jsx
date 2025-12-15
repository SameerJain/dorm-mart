import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import PreLoginBranding from "../../components/PreLoginBranding";
import FormField from "../../components/Forms/FormField";
import PasswordPolicyDisplay from "../../components/Forms/PasswordPolicyDisplay";
import { apiGet, apiPost } from "../../utils/api";
import { getPasswordPolicy, validatePassword, createPasswordMaxLengthEnforcer } from "../../utils/passwordValidation";

const NAV_BLUE = "#2563EB";

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

  const policy = useMemo(() => getPasswordPolicy(newPassword), [newPassword]);

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
        const data = await apiGet(`auth/validate-reset-token.php?token=${encodeURIComponent(token)}`);
        
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

    // Validate password using centralized validation
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setSubmitError(validation.errors[0] || "Password does not meet requirements.");
      return;
    }

    // Set loading state
    setIsLoading(true);

    try {
      // Call the reset password API
      const data = await apiPost('auth/reset-password.php', {
        token: token,
        newPassword: newPassword
      });

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
        {/* Mobile branding header (visible only on mobile/tablet) */}
        <div className="md:hidden mb-6 sm:mb-8 text-center relative z-10">
          <h1 className="text-5xl sm:text-6xl font-serif text-gray-800 mb-3 leading-tight">
            Dorm Mart
          </h1>
          <h2 className="text-xl sm:text-2xl font-light text-gray-600 opacity-90 leading-relaxed">
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
              <div className="mb-6 sm:mb-8 border-b border-white/20 pb-4 sm:pb-5">
                <div className="text-center">
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 bg-black rounded-full mx-auto mb-3 sm:mb-4"></div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-white leading-tight">
                    Reset Password
                  </h1>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-2">
                <section className="flex flex-col justify-center">
                  {isVerifyingToken && (
                    <div className="mb-6 p-4 sm:p-5 bg-white/10 border border-white/20 rounded-lg">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-white"></div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm sm:text-base text-white leading-relaxed">Verifying reset link...</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isTokenValid && !isVerifyingToken && (
                    <div className="mb-6 p-4 sm:p-5 bg-red-500/30 border-2 border-red-500 rounded-lg">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-sm sm:text-base font-medium text-red-600 mb-1">Reset Link Expired</h3>
                          <p className="text-sm sm:text-base text-red-600 leading-relaxed">{tokenError}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => navigate('/forgot-password')}
                          className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-md transition-colors font-medium text-base sm:text-lg active:scale-95"
                        >
                          Request New Reset Link
                        </button>
                        <button
                          onClick={() => navigate('/login')}
                          className="min-h-[44px] bg-white/20 hover:bg-white/30 text-white px-5 py-3 rounded-md transition-colors font-medium text-base sm:text-lg active:scale-95"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Test 1: Invalid token error */}
                  {submitError && (
                    <div className="mb-6 p-4 sm:p-5 bg-red-500/30 border-2 border-red-500 rounded-lg">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm sm:text-base text-red-600 leading-relaxed">{submitError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test 3: Password mismatch error */}
                  {passwordMismatchError && (
                    <div className="mb-6 p-4 sm:p-5 bg-yellow-100/20 border border-yellow-300/30 rounded-lg">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm sm:text-base text-white leading-relaxed">{passwordMismatchError}</p>
                        </div>
                      </div>
                    </div>
                  )}

              <FormField
                id="newPassword"
                label="New Password"
                type="password"
                value={newPassword}
                onChange={createPasswordMaxLengthEnforcer(setNewPassword)}
                placeholder="Enter new password"
                disabled={!isTokenValid || isVerifyingToken}
                required
                className="mb-6"
              />
              <FormField
                id="confirmPassword"
                label="Re-enter New Password"
                type="password"
                value={confirmPassword}
                onChange={createPasswordMaxLengthEnforcer(setConfirmPassword)}
                placeholder="Re-enter new password"
                disabled={!isTokenValid || isVerifyingToken}
                required
                className="mb-6"
              />

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading || !isTokenValid || isVerifyingToken}
                    className="mt-6 min-h-[44px] w-full xl:w-48 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium disabled:hover:scale-100 text-base sm:text-lg active:scale-95"
                  >
                    {isLoading ? 'Resetting...' : isVerifyingToken ? 'Verifying...' : 'Reset Password'}
                  </button>
                </section>

                <section className="rounded-lg border border-white/20 bg-white/10 p-5 sm:p-6 flex flex-col justify-center">
                  <h2 className="mb-5 sm:mb-6 text-xl sm:text-2xl font-serif font-semibold text-white leading-tight">
                    Password Requirements:
                  </h2>
                  <PasswordPolicyDisplay 
                    password={newPassword}
                    customLabels={{
                      minLen: "At least 8 characters",
                      lower: "At least 1 lowercase character",
                      upper: "At least 1 uppercase character",
                      special: "At least 1 special character",
                      digit: "At least 1 digit",
                      notTooLong: "No more than 64 characters"
                    }}
                    className="flex flex-col gap-3 sm:gap-4"
                  />
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