import { useState, useEffect } from "react";
import { apiGet } from "../../../utils/api";

/**
 * Hook to manage product data loading (categories and existing listing)
 */
export function useProductData(isEdit, id) {
  const [availableCategories, setAvailableCategories] = useState([]);
  const [catFetchError, setCatFetchError] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [existingData, setExistingData] = useState(null);
  const [isSold, setIsSold] = useState(false);

  // Fetch categories
  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        setCatLoading(true);
        setCatFetchError(null);
        const data = await apiGet("utility/get_categories.php");
        if (!Array.isArray(data)) throw new Error("Expected array");
        if (!ignore) {
          setAvailableCategories(data.map(String));
        }
      } catch (e) {
        if (!ignore) setCatFetchError(e?.message || "Failed to load categories.");
      } finally {
        if (!ignore) setCatLoading(false);
      }
    }
    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  // Fetch existing listing (edit mode)
  useEffect(() => {
    if (!isEdit || !id) return;

    let ignore = false;
    async function loadExistingListing() {
      try {
        setLoadingExisting(true);
        setLoadError(null);

        const data = await apiGet(`items/view.php?product_id=${encodeURIComponent(id)}`);
        if (!data || !data.product_id) {
          throw new Error("Invalid listing data received");
        }

        if (ignore) return;

        if (data.sold === true) {
          setIsSold(true);
          setLoadError("Cannot edit sold items.");
          setLoadingExisting(false);
          return;
        }

        setIsSold(false);
        setExistingData(data);
        setLoadingExisting(false);
      } catch (e) {
        if (!ignore) {
          setLoadError(e?.message || "Failed to load listing.");
          setLoadingExisting(false);
        }
      }
    }
    loadExistingListing();
    return () => {
      ignore = true;
    };
  }, [id, isEdit]);

  return {
    availableCategories,
    catFetchError,
    catLoading,
    loadingExisting,
    loadError,
    existingData,
    isSold
  };
}

