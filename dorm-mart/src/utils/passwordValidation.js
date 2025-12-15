/**
 * Password Validation Utilities
 * 
 * Centralized password validation functions for consistent password policy enforcement
 */

const MAX_LEN = 64;

/**
 * Check if password contains at least one lowercase letter
 * @param {string} password Password to check
 * @returns {boolean} True if password contains lowercase letter
 */
export const hasLower = (password) => /[a-z]/.test(password);

/**
 * Check if password contains at least one uppercase letter
 * @param {string} password Password to check
 * @returns {boolean} True if password contains uppercase letter
 */
export const hasUpper = (password) => /[A-Z]/.test(password);

/**
 * Check if password contains at least one digit
 * @param {string} password Password to check
 * @returns {boolean} True if password contains digit
 */
export const hasDigit = (password) => /\d/.test(password);

/**
 * Check if password contains at least one special character
 * @param {string} password Password to check
 * @returns {boolean} True if password contains special character
 */
export const hasSpecial = (password) => /[^A-Za-z0-9]/.test(password);

/**
 * Get password policy validation object
 * @param {string} password Password to validate
 * @returns {object} Policy object with boolean flags for each requirement
 */
export const getPasswordPolicy = (password) => ({
  minLen: password.length >= 8,
  lower: hasLower(password),
  upper: hasUpper(password),
  digit: hasDigit(password),
  special: hasSpecial(password),
  notTooLong: password.length <= MAX_LEN,
});

/**
 * Validate password against all policy requirements
 * @param {string} password Password to validate
 * @returns {object} Validation result with isValid flag and errors array
 */
export const validatePassword = (password) => {
  const errors = [];
  const policy = getPasswordPolicy(password);

  if (!policy.minLen) {
    errors.push('Password must have at least 8 characters.');
  }
  if (!policy.lower) {
    errors.push('Password must have at least 1 lowercase letter.');
  }
  if (!policy.upper) {
    errors.push('Password must have at least 1 uppercase letter.');
  }
  if (!policy.digit) {
    errors.push('Password must have at least 1 digit.');
  }
  if (!policy.special) {
    errors.push('Password must have at least 1 special character.');
  }
  if (!policy.notTooLong) {
    errors.push(`Password is too long. Maximum length is ${MAX_LEN} characters.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    policy,
  };
};

/**
 * Maximum password length constant
 */
export const MAX_PASSWORD_LENGTH = MAX_LEN;

/**
 * Creates a password input handler that enforces maximum length
 * @param {function} setter - State setter function (e.g., setPassword)
 * @returns {function} Event handler function for onChange
 */
export const createPasswordMaxLengthEnforcer = (setter) => (e) => {
  const v = e.target.value;
  if (v.length > MAX_PASSWORD_LENGTH) {
    alert(`Entered password is too long. Maximum length is ${MAX_PASSWORD_LENGTH} characters.`);
    return;
  }
  setter(v);
};



