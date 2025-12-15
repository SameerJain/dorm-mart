// src/pages/ItemForms/ProductListingPage.jsx
import { useState, useRef, useEffect } from "react";
import { useParams, useMatch, useNavigate, useLocation } from "react-router-dom";
import { MEET_LOCATION_OPTIONS } from "../../constants/meetLocations";
import { getApiBase, getPublicBase } from "../../utils/api";
import { getProxiedImageUrl } from "../../utils/imageUtils";
import { LIMITS, CATEGORIES_MAX } from "./utils/validation";
import { useProductData } from "./hooks/useProductData";
import { useProductForm } from "./hooks/useProductForm";
import { useImageCropper } from "./hooks/useImageCropper";
import { useImageUpload } from "./hooks/useImageUpload";
import { useProductSubmission } from "./hooks/useProductSubmission";
import ProductFormFields from "./components/ProductFormFields";
import ImageUploader from "./components/ImageUploader";
import ImageCropper from "./components/ImageCropper";

function ProductListingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // robust matcher for /product-listing/new in different mount contexts
  const matchNewAbs = useMatch({ path: "/product-listing/new", end: true });
  const matchNewApp = useMatch({ path: "/app/product-listing/new", end: true });
  const matchNewRel = useMatch({ path: "new", end: true });

  const isEdit = Boolean(id);
  const isNew = !isEdit && Boolean(matchNewAbs || matchNewApp || matchNewRel);

  // --- default form values ---
  const defaultForm = {
    title: "",
    categories: [],
    itemLocation: "",
    condition: "",
    description: "",
    price: "",
    acceptTrades: false,
    priceNegotiable: false,
    images: [],
  };

  const fileInputRef = useRef();
  const formTopRef = useRef(null);
  const [showTopErrorBanner, setShowTopErrorBanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Use extracted hooks
  const { 
    availableCategories, 
    catFetchError, 
    catLoading, 
    loadingExisting, 
    loadError, 
    existingData, 
    isSold 
  } = useProductData(isEdit, id);

  const formState = useProductForm(isNew, defaultForm);
  const {
    title,
    setTitle,
    categories,
    setCategories,
    itemLocation,
    setItemLocation,
    condition,
    setCondition,
    description,
    setDescription,
    price,
    setPrice,
    acceptTrades,
    setAcceptTrades,
    priceNegotiable,
    setPriceNegotiable,
    images,
    setImages,
    errors,
    setErrors,
    selectedCategory,
    setSelectedCategory,
    handleInputChange,
    removeCategory,
    addCategory,
    removeImage,
  } = formState;

  const cropperState = useImageCropper(images, setImages, setErrors, errors);
  const {
    showCropper,
    setShowCropper,
    cropImageSrc,
    setCropImageSrc,
    cropImgEl,
    setCropImgEl,
    pendingFileName,
    setPendingFileName,
    previewBoxSize,
    cropContainerRef,
    cropCanvasRef,
    selection,
    startDrag,
    onCropMouseMove,
    onCropMouseUp,
    handleCropConfirm,
    handleCropCancel,
    handlePreviewImgLoaded,
  } = cropperState;

  const { onFileChange } = useImageUpload(
    images,
    setImages,
    setErrors,
    errors,
    setShowCropper,
    setCropImageSrc,
    setCropImgEl,
    setPendingFileName
  );

  const { submitting, serverMsg, setServerMsg, publishListing, validateAll } = useProductSubmission({
    isEdit,
    id,
    isSold,
    title,
    categories,
    itemLocation,
    condition,
    description,
    price,
    acceptTrades,
    priceNegotiable,
    images,
    setErrors,
    setShowTopErrorBanner,
    formTopRef,
    defaultForm,
    setTitle,
    setCategories,
    setItemLocation,
    setCondition,
    setDescription,
    setPrice,
    setAcceptTrades,
    setPriceNegotiable,
    setImages,
    setSelectedCategory,
    setShowSuccess,
  });

  // ============================================
  // POPULATE FORM FROM EXISTING DATA (EDIT MODE)
  // ============================================
  useEffect(() => {
    if (!isEdit || !existingData) return;

    // Prevent editing sold items
    if (isSold) {
      setServerMsg("Cannot edit sold items. Please return to the seller dashboard.");
      setTimeout(() => {
        navigate("/app/seller-dashboard", { replace: true });
      }, 2000);
      return;
    }

    const data = existingData;

    // Populate form fields
    setTitle(data.title || "");
    
    // Handle categories (can be tags array or categories JSON)
    // Ensure categories are always strings, not objects
    let cats = [];
    if (Array.isArray(data.tags)) {
      cats = data.tags.map(cat => {
        // If it's an object with value/label, extract the value or label
        if (typeof cat === 'object' && cat !== null) {
          return cat.value || cat.label || String(cat);
        }
        return String(cat);
      }).filter(cat => cat && cat !== '');
    } else if (data.categories) {
      try {
        const parsed = typeof data.categories === 'string' 
          ? JSON.parse(data.categories) 
          : data.categories;
        if (Array.isArray(parsed)) {
          cats = parsed.map(cat => {
            // If it's an object with value/label, extract the value or label
            if (typeof cat === 'object' && cat !== null) {
              return cat.value || cat.label || String(cat);
            }
            return String(cat);
          }).filter(cat => cat && cat !== '');
        }
      } catch (e) {
        console.warn("Failed to parse categories:", e);
      }
    }
    setCategories(cats);

    setItemLocation(data.item_location || "");
    setCondition(data.item_condition || "");
    setDescription(data.description || "");
    setPrice(data.listing_price || "");
    setAcceptTrades(data.trades === true || data.trades === 1);
    setPriceNegotiable(data.price_nego === true || data.price_nego === 1);

    // Handle existing photos
    let existingPhotos = [];
    if (Array.isArray(data.photos)) {
      existingPhotos = data.photos;
    } else if (typeof data.photos === 'string' && data.photos) {
      try {
        const parsed = JSON.parse(data.photos);
        if (Array.isArray(parsed)) {
          existingPhotos = parsed;
        }
      } catch (e) {
        // If not JSON, treat as comma-separated
        existingPhotos = data.photos.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Convert existing photo URLs to image objects for display
    // Store original URLs separately so we can send them back
    const imageObjects = existingPhotos.map(url => {
      // Proxy images through image.php if needed (same logic as viewProduct)
      const raw = String(url);
      const proxied = getProxiedImageUrl(raw, getApiBase);
      let proxiedUrl = proxied !== raw ? proxied : (raw.startsWith("/") ? `${getPublicBase()}${raw}` : raw);
      
      return {
        file: null, // No file object for existing images
        url: proxiedUrl,
        originalUrl: url, // Store original URL for submission
      };
    });
    setImages(imageObjects);

    setSelectedCategory("");
    setErrors({}); // This already clears all errors including images
  }, [isEdit, existingData, isSold, navigate]);


  const headerText = isEdit ? "Edit Product Listing" : "New Product Listing";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            {headerText}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Fill out the form below to{" "}
            {isEdit ? "update your listing" : "create your listing"}
          </p>
        </div>

        {serverMsg && (
          <div className={`mb-4 rounded-lg border p-3 text-sm ${
            loadError ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300" 
            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
          }`}>
            {serverMsg}
          </div>
        )}

        {loadingExisting && (
          <div className="mb-4 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="text-blue-700 dark:text-blue-300 font-medium">Loading existing listing data...</p>
            </div>
          </div>
        )}

        {loadingExisting ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Loading listing data...</p>
          </div>
        ) : (
        <div ref={formTopRef}>
        {/* Top-of-Form Error Banner */}
        {showTopErrorBanner && Object.keys(errors).length > 0 && (() => {
          const errorCount = Object.keys(errors).length;
          const showSpecificErrors = errorCount <= 2;
          
          return (
            <div className="mb-6 rounded-lg border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  {showSpecificErrors ? (
                    <>
                      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                        A few things need your attention:
                      </h3>
                      <ul className="list-disc list-inside space-y-1">
                        {Object.values(errors).map((error, index) => (
                          <li key={index} className="text-sm text-red-800 dark:text-red-300">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-lg font-semibold text-red-900 dark:text-red-200">
                      Please fill out the missing information.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        <form onSubmit={publishListing} className="space-y-6">
          <ProductFormFields
            title={title}
            setTitle={setTitle}
            condition={condition}
            setCondition={setCondition}
            itemLocation={itemLocation}
            setItemLocation={setItemLocation}
            description={description}
            setDescription={setDescription}
            price={price}
            setPrice={setPrice}
            acceptTrades={acceptTrades}
            setAcceptTrades={setAcceptTrades}
            priceNegotiable={priceNegotiable}
            setPriceNegotiable={setPriceNegotiable}
            categories={categories}
            availableCategories={availableCategories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            addCategory={addCategory}
            removeCategory={removeCategory}
            errors={errors}
            setErrors={setErrors}
            handleInputChange={handleInputChange}
            MEET_LOCATION_OPTIONS={MEET_LOCATION_OPTIONS}
            CATEGORIES_MAX={CATEGORIES_MAX}
            LIMITS={LIMITS}
            catLoading={catLoading}
            catFetchError={catFetchError}
          />

          <ImageUploader
            images={images}
            errors={errors}
            fileInputRef={fileInputRef}
            onFileChange={onFileChange}
            removeImage={removeImage}
          />

            {/* Safety Tips */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 p-6 mt-6">
              <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4">
                Safety Tips
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-100 space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Consider bringing a friend, especially for high value items.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Report suspicious messages or behavior.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Trust your gut. Don't proceed if something feels off.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Keep receipts or transaction records.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-200 flex-shrink-0">•</span>
                  <span>Use secure payment methods (cash, Venmo, Zelle).</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-gray-950/30 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mt-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
                Publish Your Listing
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="submit"
                  disabled={submitting || loadingExisting}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting
                    ? "Submitting..."
                    : loadingExisting
                    ? "Loading..."
                    : isEdit
                    ? "Update Listing"
                    : "Publish Listing"}
                </button>

                <button
                  onClick={() => {
                    const returnTo = location.state?.returnTo || "/app/seller-dashboard";
                    navigate(returnTo);
                  }}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  type="button"
                >
                  {isNew ? "Cancel" : "Discard Changes"}
                </button>
              </div>
              {(catLoading || catFetchError) && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  {catLoading
                    ? "Loading categories..."
                    : `Category load error: ${catFetchError}`}
                </p>
              )}
            </div>
        </form>
        </div>
        )}
      </main>

      {/* Success Modal - Only show for new listings */}
      {showSuccess && !isEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="px-6 pt-6">
              <h2
                id="success-title"
                className="text-2xl font-bold text-green-700 dark:text-green-400"
              >
                Success
              </h2>
              <p className="mt-2 text-gray-700 dark:text-gray-200">
                Your product posting is now visible to prospective buyers.
              </p>
              <p className="mt-1 text-gray-900 dark:text-gray-100 font-semibold">
                Congrats!
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSuccess(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                Post another product
              </button>
              <button
                type="button"
                onClick={() => {
                  window.scrollTo(0, 0);
                  navigate("/app/seller-dashboard");
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                {location.state?.fromDashboard === true ? "Go back to Dashboard" : "View Dashboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cropper Modal */}
      {showCropper && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl max-w-3xl w-full p-3 md:p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">
              Crop Image
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Drag the square to choose the area you want. The square size is fixed.
            </p>

            <div className="flex justify-center">
              <div
                ref={cropContainerRef}
                onMouseMove={onCropMouseMove}
                onMouseUp={onCropMouseUp}
                onMouseLeave={onCropMouseUp}
                onTouchMove={onCropMouseMove}
                onTouchEnd={onCropMouseUp}
                className="relative bg-gray-100 dark:bg-gray-900 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 select-none"
                style={{
                  width: `${previewBoxSize}px`,
                  height: `${previewBoxSize}px`,
                  touchAction: 'none',
                }}
              >
              {cropImageSrc ? (
                <>
                  <img
                    src={cropImageSrc}
                    alt="to crop"
                    onLoad={handlePreviewImgLoaded}
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* fixed-size draggable selection */}
                  <div
                    onMouseDown={startDrag}
                    onTouchStart={startDrag}
                    style={{
                      position: "absolute",
                      left: `${selection.x}px`,
                      top: `${selection.y}px`,
                      width: `${selection.size}px`,
                      height: `${selection.size}px`,
                      border: "2px dashed #3b82f6",
                      borderRadius: "8px",
                      // IMPORTANT: we remove the giant shadow from pointer hit area
                      boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
                      cursor: "move",
                      // ensure this box can be clicked/dragged
                      pointerEvents: "auto",
                      touchAction: "none",
                    }}
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  Loading...
                </div>
              )}
              </div>
            </div>

            {/* hidden canvas */}
            <canvas
              ref={cropCanvasRef}
              width={360}
              height={360}
              className="hidden"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCropCancel}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Crop &amp; Use
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductListingPage;
