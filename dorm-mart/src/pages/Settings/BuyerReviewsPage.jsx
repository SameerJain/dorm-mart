import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SettingsLayout from "./SettingsLayout";
import StarRating from "../Reviews/StarRating";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";
const NAV_BLUE = "#2563EB";

/**
 * BuyerReviewsPage Component
 * 
 * Page for displaying buyer reviews (reviews that sellers gave to buyers)
 * Only accessible to the logged-in user viewing their own reviews
 */
function BuyerReviewsPage() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch buyer reviews on mount
  useEffect(() => {
    fetchBuyerReviews();
  }, []);

  const fetchBuyerReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      // Don't pass buyer_user_id - API will use logged-in user
      const response = await fetch(
        `${API_BASE}/reviews/get_buyer_reviews.php`,
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

  return (
    <SettingsLayout>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-3">
        <h1 className="text-2xl font-serif font-semibold" style={{ color: NAV_BLUE }}>
          Buyer Reviews
        </h1>
        <button
          type="button"
          onClick={() => navigate("/app/setting/my-profile")}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-gray-600 dark:hover:bg-gray-700"
          style={{ color: NAV_BLUE }}
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      <div className="flex flex-col gap-6">
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
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {review.seller_name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
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
    </SettingsLayout>
  );
}

export default BuyerReviewsPage;

