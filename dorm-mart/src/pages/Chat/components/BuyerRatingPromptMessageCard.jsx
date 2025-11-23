import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

function BuyerRatingPromptMessageCard({ productId, productTitle, buyerId }) {
  const navigate = useNavigate();
  const [hasRating, setHasRating] = useState(false);
  const [isLoadingRating, setIsLoadingRating] = useState(true);

  // Fetch buyer rating status on mount
  useEffect(() => {
    if (!productId) {
      setIsLoadingRating(false);
      return;
    }

    const fetchRatingStatus = async () => {
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
            setHasRating(true);
          }
        }
      } catch (error) {
        console.error("Error fetching buyer rating status:", error);
      } finally {
        setIsLoadingRating(false);
      }
    };

    fetchRatingStatus();
  }, [productId]);

  const handleRatingClick = () => {
    if (productId && buyerId) {
      navigate("/app/seller-dashboard", {
        state: {
          openBuyerRating: true,
          productId,
          productTitle,
          buyerId,
        },
      });
    }
  };

  // Different styling based on rating status - orange for pending, gray for completed
  const containerClasses = hasRating
    ? "max-w-[85%] rounded-2xl border-2 border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 overflow-hidden"
    : "max-w-[85%] rounded-2xl border-2 border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 overflow-hidden";

  const iconClasses = hasRating
    ? "w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5"
    : "w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5";

  const titleClasses = hasRating
    ? "text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1"
    : "text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1";

  const textClasses = hasRating
    ? "text-sm text-gray-600 dark:text-gray-400 mb-3"
    : "text-sm text-orange-700 dark:text-orange-300 mb-3";

  const buttonClasses = hasRating
    ? "px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
    : "px-4 py-2 bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400";

  if (isLoadingRating) {
    return null; // Don't show anything while loading
  }

  return (
    <div className="flex justify-center my-2">
      <div className={containerClasses}>
        <div className="p-4">
          <div className="flex items-start gap-2 min-w-0">
            {hasRating ? (
              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
              <p className={titleClasses}>
                {hasRating ? "Buyer Rated" : "Next Steps: Rate Buyer"}
              </p>
              <p className={`${textClasses} break-words`}>
                {hasRating
                  ? `Thank you for rating the buyer for ${productTitle || "this item"}! You can view or edit your rating anytime.`
                  : `Your purchase has been completed! Help other sellers by rating the buyer for ${productTitle || "this item"}.`}
              </p>
              <button
                onClick={handleRatingClick}
                className={buttonClasses}
              >
                {hasRating ? "View Rating" : "Rate Buyer"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuyerRatingPromptMessageCard;

