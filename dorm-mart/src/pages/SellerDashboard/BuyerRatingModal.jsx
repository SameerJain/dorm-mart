import React, { useState, useEffect } from "react";
import StarRating from "../Reviews/StarRating";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

/**
 * BuyerRatingModal Component
 * 
 * Modal for sellers to rate buyers (star rating only)
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal is closed
 * @param {number} productId - ID of the product
 * @param {string} productTitle - Title of the product (for display)
 * @param {number} buyerId - ID of the buyer being rated
 * @param {function} onRatingSubmitted - Callback after successful rating submission
 */
function BuyerRatingModal({
  isOpen,
  onClose,
  productId,
  productTitle = "Product",
  buyerId,
  onRatingSubmitted = null,
}) {
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [existingRating, setExistingRating] = useState(null);

  // Fetch existing rating when modal opens
  useEffect(() => {
    if (isOpen && productId && buyerId) {
      fetchExistingRating();
    } else if (!isOpen) {
      // Reset state when modal closes
      setExistingRating(null);
      setRating(0);
      setError(null);
    }
  }, [isOpen, productId, buyerId]);

  const fetchExistingRating = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/reviews/get_buyer_rating.php?product_id=${productId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.has_rating) {
          setExistingRating(result.rating);
          setRating(result.rating.rating || 0);
        } else {
          setExistingRating(null);
          setRating(0);
        }
      } else {
        // Reset on error
        setExistingRating(null);
        setRating(0);
      }
    } catch (error) {
      console.error("Error fetching buyer rating:", error);
      setExistingRating(null);
      setRating(0);
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && !existingRating) {
      setRating(0);
      setError(null);
    }
  }, [isOpen, existingRating]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = 'unset';
      document.body.style.overflow = 'unset';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = 'unset';
      document.body.style.overflow = 'unset';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (rating <= 0) {
      setError("Please select a rating");
      return;
    }

    // Show confirmation dialog before submitting
    const confirmed = window.confirm("Are you sure you want to submit this rating? Changes cannot be made.");
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/reviews/submit_buyer_rating.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          product_id: productId,
          buyer_user_id: buyerId,
          rating: rating,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit rating");
      }

      // Success!
      if (onRatingSubmitted) {
        onRatingSubmitted(result);
      }
      onClose();
    } catch (err) {
      console.error("Error submitting buyer rating:", err);
      setError(err.message || "Failed to submit rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = rating > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Rate Buyer
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Product: <span className="font-medium text-gray-900 dark:text-gray-100">{productTitle}</span>
            </p>
          </div>

          {existingRating ? (
            // View existing rating
            <div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Your Rating
                </label>
                <div className="flex items-center gap-4">
                  <StarRating rating={rating} readOnly={true} size={40} />
                  <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {rating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>
              {existingRating.created_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Rated on {new Date(existingRating.created_at).toLocaleDateString()}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            // Rating form
            <form onSubmit={handleSubmit}>
              {/* Rating Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Rate this Buyer <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <StarRating
                    rating={rating}
                    onRatingChange={setRating}
                    readOnly={false}
                    size={40}
                  />
                  <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {rating.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Submit Rating"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default BuyerRatingModal;

