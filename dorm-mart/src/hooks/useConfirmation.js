import { useState, useCallback } from 'react';

/**
 * Custom hook for managing confirmation dialog state
 * 
 * @returns {object} { 
 *   showConfirm, 
 *   confirmMessage, 
 *   confirmCallback, 
 *   requestConfirmation, 
 *   handleConfirm, 
 *   handleCancel 
 * }
 */
export function useConfirmation() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmCallback, setConfirmCallback] = useState(null);

  const requestConfirmation = useCallback((message, callback) => {
    setConfirmMessage(message);
    setConfirmCallback(() => callback);
    setShowConfirm(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmCallback) {
      confirmCallback();
    }
    setShowConfirm(false);
    setConfirmMessage('');
    setConfirmCallback(null);
  }, [confirmCallback]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
    setConfirmMessage('');
    setConfirmCallback(null);
  }, []);

  return {
    showConfirm,
    confirmMessage,
    confirmCallback,
    requestConfirmation,
    handleConfirm,
    handleCancel,
  };
}



