import React from 'react';
import { getPasswordPolicy } from '../../utils/passwordValidation';

/**
 * RequirementRow Component
 * Displays a single password requirement with visual indicator
 */
function RequirementRow({ ok, text, className = '' }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span
        className="inline-flex h-2.5 w-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: ok ? '#22c55e' : '#ef4444' }}
      />
      <span className={ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
        {text}
      </span>
    </div>
  );
}

/**
 * PasswordPolicyDisplay Component
 * Displays password policy requirements with visual indicators
 * 
 * @param {string} password - The password to validate
 * @param {string} [className=""] - Additional CSS classes
 * @param {object} [customLabels] - Custom labels for requirements
 */
export default function PasswordPolicyDisplay({ password, className = '', customLabels = {} }) {
  const policy = getPasswordPolicy(password || '');

  const defaultLabels = {
    minLen: 'At least 8 characters',
    lower: 'At least 1 lowercase letter',
    upper: 'At least 1 uppercase letter',
    digit: 'At least 1 digit',
    special: 'At least 1 special character',
    notTooLong: `No more than ${policy.notTooLong ? '64' : '64'} characters`,
  };

  const labels = { ...defaultLabels, ...customLabels };

  return (
    <div className={className}>
      <RequirementRow ok={policy.minLen} text={labels.minLen} />
      <RequirementRow ok={policy.lower} text={labels.lower} />
      <RequirementRow ok={policy.upper} text={labels.upper} />
      <RequirementRow ok={policy.digit} text={labels.digit} />
      <RequirementRow ok={policy.special} text={labels.special} />
      <RequirementRow ok={policy.notTooLong} text={labels.notTooLong} />
    </div>
  );
}



