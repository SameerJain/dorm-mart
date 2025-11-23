import { Link } from "react-router-dom";
import { withFallbackImage } from "../../utils/imageFallback";
import { useState, useEffect } from "react";
import ReviewModal from "../../pages/Reviews/ReviewModal";

const API_BASE = process.env.REACT_APP_API_BASE || "/api";

function PurchasedItem({ id, title, seller, date, image, autoOpenReview = false }) {
  const productIdParam = id !== undefined && id !== null ? encodeURIComponent(id) : "";
  const detailPath = `/app/viewReceipt?id=${productIdParam}`;
  const displayImage = withFallbackImage(image);
  const detailState = { id, title, seller, date, image: displayImage };

  const [hasReview, setHasReview] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(true);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Fetch review status on mount
  useEffect(() => {
    if (!id) return;

    const fetchReviewStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/reviews/get_review.php?product_id=${id}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.has_review) {
            setHasReview(true);
            setExistingReview(result.review);
          }
        }
      } catch (error) {
        console.error("Error fetching review status:", error);
      } finally {
        setIsLoadingReview(false);
      }
    };

    fetchReviewStatus();
  }, [id]);

  // Auto-open review modal if autoOpenReview prop is true and review status is loaded
  useEffect(() => {
    if (autoOpenReview && !isLoadingReview && !hasAutoOpened) {
      setIsModalOpen(true);
      setHasAutoOpened(true);
    }
  }, [autoOpenReview, isLoadingReview, hasAutoOpened]);

  const handleReviewButtonClick = () => {
    setIsModalOpen(true);
  };

  const handleReviewSubmitted = () => {
    setHasReview(true);
    // Optionally refetch the review to get the latest data
    fetchReviewAfterSubmit();
  };

  const fetchReviewAfterSubmit = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/reviews/get_review.php?product_id=${id}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.has_review) {
          setExistingReview(result.review);
        }
      }
    } catch (error) {
      console.error("Error fetching review after submit:", error);
    }
  };

  return (
    <>
      <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 shadow">
        {/* Left: image */}
        <Link
          to={detailPath}
          state={detailState}
          className="block"
        >
          <img
            src={displayImage}
            alt="Item"
            className="w-full h-48 sm:w-40 sm:h-40 object-cover rounded select-none"
          />
        </Link>

        {/* Middle: details */}
        <div className="flex flex-col flex-1">
          {/* Top: title + seller */}
          <div className="mt-2 sm:mt-0">
            <h3 className="text-base sm:text-lg font-semibold line-clamp-2 text-gray-900 dark:text-gray-100">
              <Link
                to={detailPath}
                state={detailState}
                className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
              >
                {title}
              </Link>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Sold by {seller}</p>
          </div>

          {/* Bottom: date */}
          <p className="mt-2 sm:mt-1 text-sm text-gray-500 dark:text-gray-400">Purchased on {date}</p>
        </div>

        {/* Right: buttons */}
        <div className="flex flex-col gap-2 mt-3 sm:mt-0 w-full sm:w-auto">
          <Link
            to={detailPath}
            state={detailState}
            className="text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            See Receipt
          </Link>

          {/* Review Button */}
          {!isLoadingReview && (
            <button
              onClick={handleReviewButtonClick}
              disabled={isLoadingReview}
              className={`text-center px-4 py-2 text-white rounded active:scale-[0.99] focus:outline-none focus:ring-2 ${
                hasReview
                  ? "bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 focus:ring-gray-700 cursor-pointer"
                  : "bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 focus:ring-purple-700"
              }`}
            >
              {hasReview ? "Review Completed" : "Leave a Review"}
            </button>
          )}
        </div>
      </li>

      {/* Review Modal */}
      <ReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={hasReview ? "view" : "create"}
        productId={id}
        productTitle={title}
        existingReview={existingReview}
        onReviewSubmitted={handleReviewSubmitted}
        viewMode="buyer"
      />
    </>
  );
}

export default PurchasedItem;
