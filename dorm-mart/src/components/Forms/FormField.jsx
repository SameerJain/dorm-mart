import React from 'react';

/**
 * Standardized Form Field Component
 * 
 * @param {string} id - Field ID
 * @param {string} label - Field label
 * @param {string} type - Input type (default: 'text')
 * @param {string|number} value - Field value
 * @param {function} onChange - Change handler
 * @param {string} placeholder - Placeholder text
 * @param {string} error - Error message to display
 * @param {boolean} required - Whether field is required
 * @param {number} maxLength - Maximum length
 * @param {string} className - Additional CSS classes
 * @param {object} inputProps - Additional input props
 */
export default function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  maxLength,
  className = '',
  ...inputProps
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-600'
        }`}
        {...inputProps}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}



