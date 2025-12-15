import React, { useState, useEffect } from "react";
import StarRating from "./StarRating";
import { getApiBase, apiPost } from "../../utils/api";

/**
 * ReviewModal Component
 * 
 * Displays a modal for creating or viewing product reviews
 * 
 * Modes:
 * - "create": Shows form to create a new review with star rating and text input
 * - "view": Shows read-only display of existing review
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Callback when modal is closed
 * @param {string} mode - "create" or "view"
 * @param {number} productId - ID of the product being reviewed
 * @param {string} productTitle - Title of the product (for display)
 * @param {object} existingReview - Existing review data (for view mode)
 * @param {function} onReviewSubmitted - Callback after successful review submission
 * @param {string} viewMode - "buyer" or "seller" - affects photo display in view mode
 */
function ReviewModal({
  isOpen,
  onClose,
  mode = "create",
  productId,
  productTitle = "Product",
  existingReview = null,
  onReviewSubmitted = null,
  viewMode = "buyer",
}) {
  const [rating, setRating] = useState(0);
  const [productRating, setProductRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [charCount, setCharCount] = useState(0);
  const [uploadedImages, setUploadedImages] = useState([]); // Array of {file, url, uploadedUrl}
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // For full-size image modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState(null);
  const [pendingSubmit, setPendingSubmit] = useState(false); // Track if we're waiting for confirmation
  const fileInputRef = React.useRef(null);

  const maxChars = 1000;
  const maxImages = 3;

  // Reset form when modal opens in create mode
  useEffect(() => {
    if (isOpen && mode === "create") {
      setRating(0);
      setProductRating(0);
      setReviewText("");
      setCharCount(0);
      setError(null);
      setUploadedImages([]);
      // Don't reset confirmation modal state here - let handleSubmit control it
    } else if (!isOpen) {
      // Only reset confirmation modal state when modal closes
      setShowConfirmModal(false);
      setConfirmMessage("");
      setConfirmCallback(null);
      setPendingSubmit(false);
    }
  }, [isOpen, mode]);

  // Load existing review data in view mode
  useEffect(() => {
    if (isOpen && mode === "view" && existingReview) {
      setRating(existingReview.rating || 0);
      setProductRating(existingReview.product_rating || 0);
      setReviewText(existingReview.review_text || "");
      setSelectedImage(null); // Reset selected image when modal opens
      // Load images with proper API base path
      if (existingReview.image1_url || existingReview.image2_url || existingReview.image3_url) {
        const images = [];
        if (existingReview.image1_url) images.push({ uploadedUrl: existingReview.image1_url });
        if (existingReview.image2_url) images.push({ uploadedUrl: existingReview.image2_url });
        if (existingReview.image3_url) images.push({ uploadedUrl: existingReview.image3_url });
        setUploadedImages(images);
      }
    }
  }, [isOpen, mode, existingReview]);

  // Reset selectedImage when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
    }
  }, [isOpen]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Prevent scroll on both html and body
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll
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
      // Cleanup: ensure scroll is restored
      document.documentElement.style.overflow = 'unset';
      document.body.style.overflow = 'unset';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const handleReviewTextChange = (e) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setReviewText(text);
      setCharCount(text.length);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (mode !== "create") return false;
    return rating > 0 || productRating > 0 || reviewText.trim().length > 0 || uploadedImages.length > 0;
  };

  // Handle close with confirmation if needed
  const handleClose = () => {
    if (hasUnsavedChanges()) {
      setConfirmMessage("You have unsaved changes. Are you sure you want to close?");
      setConfirmCallback(() => {
        setShowConfirmModal(false);
        onClose();
      });
      setShowConfirmModal(true);
      return;
    }
    onClose();
  };

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Check if adding these would exceed max
    if (uploadedImages.length + files.length > maxImages) {
      setError(`You can only upload up to ${maxImages} images`);
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError("Please select only image files");
        continue;
      }

      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("Each image must be less than 2MB");
        continue;
      }

      // Upload immediately
      try {
        const formData = new FormData();
        formData.append('image', file);

        // Use fetch directly for FormData (apiPost uses JSON.stringify)
        const response = await fetch(`${getApiBase()}/reviews/upload_review_image.php`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to upload image');
        }

        // Add to uploaded images with both preview URL and server URL
        setUploadedImages(prev => [...prev, {
          file,
          previewUrl: URL.createObjectURL(file),
          uploadedUrl: result.image_url
        }]);
      } catch (err) {
        setError(err.message || 'Failed to upload image');
      }
    }

    setIsUploadingImage(false);
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      // Revoke the preview URL to free memory
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleDownloadImage = async (imageUrl, filename) => {
    try {
      const response = await fetch(`${getApiBase()}/media/image.php?url=${encodeURIComponent(imageUrl)}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (mode !== "create") return;
    if (isSubmitting || pendingSubmit) return; // Prevent double submission
    
    if (rating <= 0) {
      setError("Please select a seller rating");
      return;
    }
    if (productRating <= 0) {
      setError("Please select a product rating");
      return;
    }
    if (reviewText.trim().length === 0) {
      setError("Please write a review");
      return;
    }

    // Set pending submit flag to prevent direct submission
    setPendingSubmit(true);
    
    // Show confirmation dialog before submitting
    const message = "Are you sure you are done writing your review? Changes cannot be made.";
    setConfirmMessage(message);
    
    // Create callback function that will be called when user confirms
    const callback = async () => {
      // Close confirmation modal first
      setShowConfirmModal(false);
      setConfirmMessage("");
      // Don't reset confirmCallback or pendingSubmit yet - proceedWithSubmit needs them for safety check
      // Then proceed with submission
      await proceedWithSubmit();
      // Reset state after submission completes
      setConfirmCallback(null);
      setPendingSubmit(false);
    };
    // Store the callback function directly
    setConfirmCallback(() => callback);
    
    // Set state to show confirmation modal
    setShowConfirmModal(true);
    return; // Important: stop execution here, don't proceed with submission
  };

  const proceedWithSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare image URLs (up to 3)
      const imageUrls = {
        image1_url: uploadedImages[0]?.uploadedUrl || null,
        image2_url: uploadedImages[1]?.uploadedUrl || null,
        image3_url: uploadedImages[2]?.uploadedUrl || null,
      };

      const result = await apiPost('reviews/submit_review.php', {
        product_id: productId,
        rating: rating,
        product_rating: productRating,
        review_text: reviewText.trim(),
        ...imageUrls,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to submit review");
      }

      // Success!
      if (onReviewSubmitted) {
        onReviewSubmitted(result);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = rating > 0 && productRating > 0 && reviewText.trim().length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        // Prevent closing main modal when confirmation modal is open
        if (!showConfirmModal && e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxHeight: '90vh'
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {mode === "create" ? "Leave a Review" : "Review"}
          </h2>
          <button
            onClick={handleClose}
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
        <div className="px-6 py-6 overflow-y-auto flex-1 min-h-0" style={{ minWidth: 0 }}>
          <div className="mb-4 min-w-0">
            <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
              Product: <span className="font-medium text-gray-900 dark:text-gray-100 break-words">{productTitle}</span>
            </p>
          </div>

          {mode === "create" ? (
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              e.stopPropagation(); 
              return false; 
            }}>
              {/* Seller Rating Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Rate your experience with this Seller <span className="text-red-500">*</span>
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

              {/* Product Rating Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Rate this product <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <StarRating
                    rating={productRating}
                    onRatingChange={setProductRating}
                    readOnly={false}
                    size={40}
                  />
                  <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {productRating.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Review Text Section */}
              <div className="mb-6">
                <label htmlFor="review-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Review <span className="text-red-500">*</span>
                </label>
                <div 
                  className="overflow-hidden border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  style={{
                    borderRadius: '0.5rem',
                    borderTopLeftRadius: '0.5rem',
                    borderTopRightRadius: '0.5rem',
                    borderBottomLeftRadius: '0.5rem',
                    borderBottomRightRadius: '0.5rem'
                  }}
                >
                  <textarea
                    id="review-text"
                    value={reviewText}
                    onChange={handleReviewTextChange}
                    placeholder="Share your experience with this product..."
                    rows={6}
                    maxLength={maxChars}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    style={{
                      border: 'none',
                      borderRadius: '0',
                      overflow: 'auto',
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
                    }}
                    required
                  />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {charCount} / {maxChars} characters
                  </p>
                  {charCount >= maxChars && (
                    <p className="text-xs text-red-500">Maximum character limit reached</p>
                  )}
                </div>
              </div>

              {/* Image Upload Section */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Images (Optional, max 3)
                </label>
                
                {/* Upload Button */}
                {uploadedImages.length < maxImages && (
                  <div className="mb-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                      disabled={isUploadingImage}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploadingImage ? "Uploading..." : "Add Images"}
                    </button>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {uploadedImages.length} / {maxImages}
                    </span>
                  </div>
                )}

                {/* Image Previews */}
                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.previewUrl}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit(e);
                  }}
                  disabled={!isFormValid || isSubmitting}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : "Complete"}
                </button>
              </div>
            </form>
          ) : (
            // View Mode
            <div>
              {/* Seller Rating Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Seller Rating
                </label>
                <div className="flex items-center gap-3">
                  <StarRating rating={rating} readOnly={true} size={32} />
                  <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {rating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              {/* Product Rating Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Product Rating
                </label>
                <div className="flex items-center gap-3">
                  <StarRating rating={productRating} readOnly={true} size={32} />
                  <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {productRating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              {/* Review Text Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Review
                </label>
                <div 
                  className="review-text-rounded p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  style={{
                    borderRadius: '0.5rem',
                    WebkitBorderRadius: '0.5rem',
                    MozBorderRadius: '0.5rem',
                    overflow: 'hidden'
                  }}
                >
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                    {reviewText}
                  </p>
                </div>
              </div>

              {/* Review Images Display */}
              {(existingReview?.image1_url || existingReview?.image2_url || existingReview?.image3_url) && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Images
                  </label>
                  {viewMode === "seller" ? (
                    // Seller view: Full-size images with download
                    <div className="space-y-4">
                      {existingReview.image1_url && (
                        <div className="relative group">
                          <img
                            src={`${getApiBase()}/media/image.php?url=${encodeURIComponent(existingReview.image1_url)}`}
                            alt="Review image 1"
                            onClick={() => setSelectedImage(existingReview.image1_url)}
                            className="w-full max-h-96 object-contain rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(existingReview.image1_url, 'review-image-1.jpg');
                            }}
                            className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Download
                          </button>
                        </div>
                      )}
                      {existingReview.image2_url && (
                        <div className="relative group">
                          <img
                            src={`${getApiBase()}/media/image.php?url=${encodeURIComponent(existingReview.image2_url)}`}
                            alt="Review image 2"
                            onClick={() => setSelectedImage(existingReview.image2_url)}
                            className="w-full max-h-96 object-contain rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(existingReview.image2_url, 'review-image-2.jpg');
                            }}
                            className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Download
                          </button>
                        </div>
                      )}
                      {existingReview.image3_url && (
                        <div className="relative group">
                          <img
                            src={`${getApiBase()}/media/image.php?url=${encodeURIComponent(existingReview.image3_url)}`}
                            alt="Review image 3"
                            onClick={() => setSelectedImage(existingReview.image3_url)}
                            className="w-full max-h-96 object-contain rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(existingReview.image3_url, 'review-image-3.jpg');
                            }}
                            className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Download
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Buyer view: Small thumbnails
                    <div className="grid grid-cols-3 gap-3">
                      {existingReview.image1_url && (
                        <img
                          src={`${getApiBase()}/media/image.php?url=${encodeURIComponent(existingReview.image1_url)}`}
                          alt="Review image 1"
                          className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90"
                        />
                      )}
                      {existingReview.image2_url && (
                        <img
                          src={`${getApiBase()}/media/image.php?url=${encodeURIComponent(existingReview.image2_url)}`}
                          alt="Review image 2"
                          className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90"
                        />
                      )}
                      {existingReview.image3_url && (
                        <img
                          src={`${getApiBase()}/media/image.php?url=${encodeURIComponent(existingReview.image3_url)}`}
                          alt="Review image 3"
                          className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-90"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Full-size image modal for seller view */}
              {viewMode === "seller" && selectedImage && (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-75 p-4"
                  onClick={() => setSelectedImage(null)}
                >
                  <div className="relative max-w-7xl max-h-full">
                    <img
                      src={`${getApiBase()}/media/image.php?url=${encodeURIComponent(selectedImage)}`}
                      alt="Full size review image"
                      className="max-w-full max-h-[90vh] object-contain rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="absolute top-4 right-4 bg-white hover:bg-gray-100 text-gray-900 rounded-full p-2 shadow-lg"
                      aria-label="Close"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {existingReview?.created_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Submitted on {new Date(existingReview.created_at).toLocaleDateString()}
                </p>
              )}

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" 
          role="dialog" 
          aria-modal="true"
          onClick={(e) => {
            // Close confirmation modal if clicking backdrop
            if (e.target === e.currentTarget) {
              setShowConfirmModal(false);
              setConfirmMessage("");
              setConfirmCallback(null);
              setPendingSubmit(false); // Reset pending submit flag
            }
          }}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="px-6 pt-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Ready to Submit?</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{confirmMessage}</p>
              </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmMessage("");
                  setConfirmCallback(null);
                  setPendingSubmit(false); // Reset pending submit flag
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirmCallback) {
                    try {
                      // confirmCallback is the actual callback function - call it directly
                      await confirmCallback();
                    } catch (err) {
                      // Error is already handled in proceedWithSubmit
                      // Reset confirmation modal state on error
                      setShowConfirmModal(false);
                      setConfirmMessage("");
                      setConfirmCallback(null);
                      setPendingSubmit(false);
                    }
                  } else {
                    setShowConfirmModal(false);
                    setConfirmMessage("");
                    setConfirmCallback(null);
                    setPendingSubmit(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewModal;

