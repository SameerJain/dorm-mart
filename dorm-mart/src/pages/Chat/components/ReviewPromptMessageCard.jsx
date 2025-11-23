import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

function ReviewPromptMessageCard({ productId, productTitle }) {
  const navigate = useNavigate();
  const [hasReview, setHasReview] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(true);

  // Fetch review status on mount
  useEffect(() => {
    if (!productId) {
      setIsLoadingReview(false);
      return;
    }

    const fetchReviewStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/reviews/get_review.php?product_id=${productId}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.has_review) {
            setHasReview(true);
          }
        }
      } catch (error) {
        console.error("Error fetching review status:", error);
      } finally {
        setIsLoadingReview(false);
      }
    };

    fetchReviewStatus();
  }, [productId]);

  const handleReviewClick = () => {
    if (productId) {
      navigate(`/app/purchase-history?review=${encodeURIComponent(productId)}`);
    }
  };

  // Different styling based on review status - orange for pending, gray for completed
  const containerClasses = hasReview
    ? "max-w-[85%] rounded-2xl border-2 border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 overflow-hidden"
    : "max-w-[85%] rounded-2xl border-2 border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 overflow-hidden";

  const iconClasses = hasReview
    ? "w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5"
    : "w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5";

  const titleClasses = hasReview
    ? "text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
    : "text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1";

  const textClasses = hasReview
    ? "text-sm text-gray-600 dark:text-gray-400 mb-3"
    : "text-sm text-orange-700 dark:text-orange-300 mb-3";

  const buttonClasses = hasReview
    ? "px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
    : "px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400";

  if (isLoadingReview) {
    return null; // Don't show anything while loading
  }

  return (
    <div className="flex justify-center my-2">
      <div className={containerClasses}>
        <div className="p-4">
          <div className="flex items-start gap-2 min-w-0">
            {hasReview ? (
              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            )}
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <p className={titleClasses}>
                {hasReview ? "Review Completed" : "Next Steps: Leave a Review"}
              </p>
              <p className={`${textClasses} break-words`}>
                {hasReview
                  ? `Thank you for leaving a review for ${productTitle || "this item"}! You can view or edit your review anytime.`
                  : `Your purchase has been completed! Help other buyers by leaving a review for ${productTitle || "this item"}.`}
              </p>
              <button
                onClick={handleReviewClick}
                className={buttonClasses}
              >
                {hasReview ? "View Review" : "Leave a Review"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewPromptMessageCard;

