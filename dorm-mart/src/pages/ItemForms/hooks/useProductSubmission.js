import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../../../utils/api";
import { validateTitle, validatePrice, validateDescription, validateCategories, validateImages } from "../utils/validation";

/**
 * Hook to manage product submission logic
 */
export function useProductSubmission({
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
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null);

  const validateAll = () => {
    const newErrors = {};

    const titleError = validateTitle(title);
    if (titleError) newErrors.title = titleError;

    const descriptionError = validateDescription(description);
    if (descriptionError) newErrors.description = descriptionError;

    const priceError = validatePrice(price);
    if (priceError) {
      if (priceError.includes("inappropriate numbers")) {
        newErrors.price = "The price has a meme input in it. Please try a different price.";
      } else {
        newErrors.price = priceError;
      }
    }

    const categoriesError = validateCategories(categories);
    if (categoriesError) {
      if (categoriesError.includes("At least one")) {
        newErrors.categories = "Select at least one category";
      } else {
        newErrors.categories = categoriesError;
      }
    }

    if (!itemLocation) {
      newErrors.itemLocation = "Select an item location";
    }
    if (!condition || condition === "") {
      newErrors.condition = "Select an item condition";
    }

    const imagesError = validateImages(images);
    if (imagesError) newErrors.images = imagesError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const publishListing = async (e) => {
    e.preventDefault();
    setServerMsg(null);
    
    if (isEdit && isSold) {
      setServerMsg("Cannot edit sold items.");
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    
    if (!validateAll()) {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowTopErrorBanner(true);
      return;
    }
    setShowTopErrorBanner(false);

    const fd = new FormData();
    fd.append("mode", isEdit ? "update" : "create");
    if (isEdit) fd.append("id", String(id));
    fd.append("title", title.trim());
    categories.forEach((c) => fd.append("tags[]", c));
    fd.append("meetLocation", itemLocation);
    fd.append("condition", condition);
    fd.append("description", description);
    fd.append("price", String(Number(price)));
    fd.append("acceptTrades", acceptTrades ? "1" : "0");
    fd.append("priceNegotiable", priceNegotiable ? "1" : "0");

    const existingPhotoUrls = [];
    images.forEach((img) => {
      if (img?.file) {
        fd.append(
          "images[]",
          img.file,
          img.file.name || `image_${Date.now()}.png`
        );
      } else if (img?.originalUrl) {
        existingPhotoUrls.push(img.originalUrl);
      }
    });

    if (isEdit && existingPhotoUrls.length > 0) {
      existingPhotoUrls.forEach((url) => {
        fd.append("existingPhotos[]", url);
      });
    }

    try {
      setSubmitting(true);
      const data = await apiPost('seller-dashboard/product_listing.php', fd);

      if (!data?.ok) {
        setServerMsg(data?.message || data?.error || "Submission failed.");
        return;
      }

      const pid = data?.prod_id ?? data?.product_id ?? null;
      
      if (isEdit) {
        const returnTo = location.state?.returnTo || "/app/seller-dashboard";
        navigate(returnTo);
      } else {
        setShowSuccess(true);
        setTitle(defaultForm.title);
        setCategories([]);
        setItemLocation(defaultForm.itemLocation);
        setCondition(defaultForm.condition);
        setDescription(defaultForm.description);
        setPrice(defaultForm.price);
        setAcceptTrades(defaultForm.acceptTrades);
        setPriceNegotiable(defaultForm.priceNegotiable);
        setImages([]);
        setSelectedCategory("");
        setErrors({});
      }
    } catch (err) {
      setServerMsg(err?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    serverMsg,
    setServerMsg,
    publishListing,
    validateAll,
  };
}



