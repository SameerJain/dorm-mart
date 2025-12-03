import React, { useState, useEffect } from "react";
import StarRating from "../Reviews/StarRating";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

/**
 * BuyerReviewsModal Component
 * 
 * Modal for displaying buyer reviews (reviews that sellers gave to buyers)
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal is closed
 * @param {number} buyerUserId - ID of the buyer whose reviews to display
 */
function BuyerReviewsModal({
  isOpen,
  onClose,
  buyerUserId,
}) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch buyer reviews when modal opens
  useEffect(() => {
    if (isOpen && buyerUserId) {
      fetchBuyerReviews();
    } else if (!isOpen) {
      // Reset state when modal closes
      setReviews([]);
      setError(null);
    }
  }, [isOpen, buyerUserId]);

  const fetchBuyerReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `${API_BASE}/reviews/get_buyer_reviews.php?buyer_user_id=${buyerUserId}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch buyer reviews");
      }

      const result = await response.json();
      if (result.success) {
        setReviews(result.reviews || []);
      } else {
        throw new Error(result.error || "Failed to fetch buyer reviews");
      }
    } catch (err) {
      console.error("Error fetching buyer reviews:", err);
      setError(err.message || "Failed to load buyer reviews. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Buyer Reviews
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
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-600 dark:text-gray-400">Loading reviews...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No buyer reviews yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 min-w-0">
              {reviews.map((review) => (
                <div
                  key={review.rating_id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50 min-w-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100 break-words">
                        {review.seller_name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
                        {review.product_title}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <StarRating rating={review.rating} readOnly={true} size={24} />
                    </div>
                  </div>
                  
                  {/* Review Text */}
                  {review.review_text && (
                    <div className="mb-3 min-w-0">
                      <div 
                        className="p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 min-w-0 overflow-hidden"
                        style={{
                          borderRadius: '0.5rem',
                          WebkitBorderRadius: '0.5rem',
                          MozBorderRadius: '0.5rem',
                          overflow: 'hidden'
                        }}
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words break-all overflow-wrap-anywhere" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                          {review.review_text}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  {review.created_at && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BuyerReviewsModal;

