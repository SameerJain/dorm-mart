import { useState, useEffect } from "react";
import { LIMITS, CATEGORIES_MAX } from "../utils/validation";

/**
 * Hook to manage product form state and handlers
 */
export function useProductForm(isNew, defaultForm) {
  const [title, setTitle] = useState(defaultForm.title);
  const [categories, setCategories] = useState(defaultForm.categories);
  const [itemLocation, setItemLocation] = useState(defaultForm.itemLocation);
  const [condition, setCondition] = useState(defaultForm.condition);
  const [description, setDescription] = useState(defaultForm.description);
  const [price, setPrice] = useState(defaultForm.price);
  const [acceptTrades, setAcceptTrades] = useState(defaultForm.acceptTrades);
  const [priceNegotiable, setPriceNegotiable] = useState(defaultForm.priceNegotiable);
  const [images, setImages] = useState([]);
  const [errors, setErrors] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("");

  // Reset form when switching to new mode
  useEffect(() => {
    if (isNew) {
      setTitle(defaultForm.title);
      setCategories([...defaultForm.categories]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  const handleInputChange = (field, value, setter) => {
    if (field === "title" && value.length > LIMITS.title) return;
    if (field === "description" && value.length > LIMITS.description) return;
    
    if (field === "price") {
      if (value === "") {
        setter(value);
        return;
      }
      
      const decimalCount = (value.match(/\./g) || []).length;
      if (decimalCount > 1) return;
      
      const validPricePattern = /^\d*\.?\d*$/;
      if (!validPricePattern.test(value)) return;
      
      if (value !== "" && !isNaN(parseFloat(value)) && parseFloat(value) > LIMITS.price) return;
    }
    
    setter(value);
    if (errors[field]) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne[field];
        return ne;
      });
    }
  };

  const removeCategory = (val) => {
    const next = categories.filter((c) => c !== val);
    setCategories(next);
    setErrors((p) => {
      const ne = { ...p };
      if (next.length && next.length <= CATEGORIES_MAX) delete ne.categories;
      return ne;
    });
  };

  const addCategory = (val) => {
    if (!val || categories.includes(val)) return;
    if (categories.length >= CATEGORIES_MAX) {
      setErrors((prev) => ({
        ...prev,
        categories: `Maximum ${CATEGORIES_MAX} categories allowed.`,
      }));
      return;
    }
    const next = [...categories, val];
    setCategories(next);
    setErrors((prev) => {
      const ne = { ...prev };
      if (next.length > 0) delete ne.categories;
      return ne;
    });
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated;
    });
    if (errors.images) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne.images;
        return ne;
      });
    }
  };

  // Clear image error when images are added
  useEffect(() => {
    if (images.length > 0 && errors.images) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne.images;
        return ne;
      });
    }
  }, [images.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
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
  };
}



