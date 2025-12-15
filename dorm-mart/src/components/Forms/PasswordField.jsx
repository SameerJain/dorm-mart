import React from 'react';
import FormField from './FormField';
import PasswordPolicyDisplay from './PasswordPolicyDisplay';

/**
 * PasswordField Component
 * Password input field with integrated policy display
 * 
 * @param {string} id - The unique ID for the input and label's htmlFor
 * @param {string} label - The label text for the input
 * @param {string} value - The current value of the input
 * @param {function} onChange - The handler for input value changes
 * @param {string} [placeholder=""] - The placeholder text for the input
 * @param {string} [error] - Optional error message to display below the input
 * @param {string} [className=""] - Additional CSS classes for the wrapper div
 * @param {boolean} [required=false] - Indicates if the field is required
 * @param {boolean} [showPolicy=false] - Whether to show password policy display
 * @param {object} [inputProps={}] - Additional props to pass directly to the input element
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = '',
  error,
  className = '',
  required = false,
  showPolicy = false,
  ...inputProps
}) {
  return (
    <div className={className}>
      <FormField
        id={id}
        label={label}
        type="password"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        error={error}
        required={required}
        {...inputProps}
      />
      {showPolicy && (
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <PasswordPolicyDisplay password={value} />
        </div>
      )}
    </div>
  );
}



