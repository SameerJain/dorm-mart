import { useState, useCallback } from 'react';

/**
 * Custom hook for form validation
 * 
 * @param {object} validationRules - Validation rules object
 * @param {function} validationRules[key].required - Whether field is required
 * @param {number} validationRules[key].minLength - Minimum length
 * @param {number} validationRules[key].maxLength - Maximum length
 * @param {number} validationRules[key].min - Minimum numeric value
 * @param {number} validationRules[key].max - Maximum numeric value
 * @param {RegExp} validationRules[key].pattern - Regex pattern to match
 * @param {function} validationRules[key].custom - Custom validation function
 * @returns {object} { errors, validate, validateField, isValid, clearErrors, setError }
 */
export function useFormValidation(validationRules = {}) {
  const [errors, setErrors] = useState({});

  const validateField = useCallback((fieldName, value, rules = null) => {
    const fieldRules = rules || validationRules[fieldName];
    if (!fieldRules) return null;

    const errorMessages = [];

    // Required check
    if (fieldRules.required) {
      if (value === null || value === undefined || value === '') {
        errorMessages.push(`${fieldName} is required`);
      }
    }

    // Skip other validations if value is empty and not required
    if ((value === null || value === undefined || value === '') && !fieldRules.required) {
      return null;
    }

    // String length checks
    if (typeof value === 'string') {
      if (fieldRules.minLength !== undefined && value.length < fieldRules.minLength) {
        errorMessages.push(`${fieldName} must be at least ${fieldRules.minLength} characters`);
      }
      if (fieldRules.maxLength !== undefined && value.length > fieldRules.maxLength) {
        errorMessages.push(`${fieldName} must be no more than ${fieldRules.maxLength} characters`);
      }
    }

    // Numeric value checks
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (!isNaN(numValue) && typeof numValue === 'number') {
      if (fieldRules.min !== undefined && numValue < fieldRules.min) {
        errorMessages.push(`${fieldName} must be at least ${fieldRules.min}`);
      }
      if (fieldRules.max !== undefined && numValue > fieldRules.max) {
        errorMessages.push(`${fieldName} must be no more than ${fieldRules.max}`);
      }
    }

    // Pattern check
    if (fieldRules.pattern && typeof value === 'string') {
      if (!fieldRules.pattern.test(value)) {
        errorMessages.push(`${fieldName} format is invalid`);
      }
    }

    // Custom validation
    if (fieldRules.custom && typeof fieldRules.custom === 'function') {
      const customError = fieldRules.custom(value);
      if (customError) {
        errorMessages.push(customError);
      }
    }

    return errorMessages.length > 0 ? errorMessages[0] : null;
  }, [validationRules]);

  const validate = useCallback((formData) => {
    const newErrors = {};
    let hasErrors = false;

    Object.keys(validationRules).forEach((fieldName) => {
      const value = formData[fieldName];
      const error = validateField(fieldName, value);
      if (error) {
        newErrors[fieldName] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  }, [validationRules, validateField]);

  const isValid = useCallback((formData) => {
    return Object.keys(validationRules).every((fieldName) => {
      const value = formData[fieldName];
      const error = validateField(fieldName, value);
      return !error;
    });
  }, [validationRules, validateField]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const setError = useCallback((fieldName, message) => {
    setErrors(prev => ({ ...prev, [fieldName]: message }));
  }, []);

  return {
    errors,
    validate,
    validateField,
    isValid,
    clearErrors,
    setError,
  };
}



