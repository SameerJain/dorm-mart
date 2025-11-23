// src/pages/ItemForms/ProductListingPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useParams, useMatch, useNavigate, useLocation } from "react-router-dom";
import { MEET_LOCATION_OPTIONS } from "../../constants/meetLocations";

// Check if price string contains meme numbers (666, 67, 420, 69, 80085, 8008, 5318008, 1488, 42069, 6969, 42042, 66666)
function containsMemePrice(priceString) {
  if (!priceString) return false;
  const priceStr = String(priceString);
  const memeNumbers = ['666', '67', '420', '69', '80085', '8008', '5318008', '1488', '42069', '6969', '42042', '66666'];
  return memeNumbers.some(meme => priceStr.includes(meme));
}

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

  // --- form state ---
  const [title, setTitle] = useState(defaultForm.title);
  const [categories, setCategories] = useState(defaultForm.categories);
  const [itemLocation, setItemLocation] = useState(defaultForm.itemLocation);
  const [condition, setCondition] = useState(defaultForm.condition);
  const [description, setDescription] = useState(defaultForm.description);
  const [price, setPrice] = useState(defaultForm.price);
  const [acceptTrades, setAcceptTrades] = useState(defaultForm.acceptTrades);
  const [priceNegotiable, setPriceNegotiable] = useState(
    defaultForm.priceNegotiable
  );
  const [images, setImages] = useState([]); // [{file, url}, ...]
  const fileInputRef = useRef();
  const formTopRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverMsg, setServerMsg] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [showTopErrorBanner, setShowTopErrorBanner] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // success modal
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdProdId, setCreatedProdId] = useState(null);

  // API base URL (respects .env)
  const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

  // categories dropdown state
  const [availableCategories, setAvailableCategories] = useState([]);
  const [catFetchError, setCatFetchError] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  const CATEGORIES_MAX = 3;

  const LIMITS = {
    title: 70,
    description: 1000,
    price: 9999.99,
    priceMin: 0.01,
  };

  // File type restrictions (same as chat)
  const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
  const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

  // ========== CROPPER STATE ==========
  const [showCropper, setShowCropper] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropImgEl, setCropImgEl] = useState(null);
  const [pendingFileName, setPendingFileName] = useState("");
  
  // Responsive preview box size - smaller on mobile
  const [previewBoxSize, setPreviewBoxSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      return isMobile ? Math.min(480, window.innerWidth - 80) : 480;
    }
    return 480;
  });

  // Update preview box size on window resize
  useEffect(() => {
    const updatePreviewSize = () => {
      const isMobile = window.innerWidth < 768;
      setPreviewBoxSize(isMobile ? Math.min(480, window.innerWidth - 80) : 480);
    };

    window.addEventListener('resize', updatePreviewSize);
    return () => window.removeEventListener('resize', updatePreviewSize);
  }, []);

  // Prevent body scroll when cropper modal is open
  useEffect(() => {
    if (showCropper) {
      const scrollY = window.scrollY;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      const scrollY = document.body.style.top;
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [showCropper]);

  // we still keep React state for display/selection so UI updates,
  // but we ALSO mirror them in refs so drag reads the latest values.
  const [displayInfo, setDisplayInfo] = useState({
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
    scale: 1,
  });
  const displayInfoRef = useRef({
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
    scale: 1,
  });

  const [selection, setSelection] = useState({
    x: 0,
    y: 0,
    size: 200,
  });
  const selectionRef = useRef({
    x: 0,
    y: 0,
    size: 200,
  });

  // drag refs
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const selectionStartRef = useRef({ x: 0, y: 0 });

  const cropCanvasRef = useRef(null);
  const cropContainerRef = useRef(null);

  // ============================================
  // FETCH CATEGORIES
  // ============================================
  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        setCatLoading(true);
        setCatFetchError(null);
        const res = await fetch("api/utility/get_categories.php", {
          credentials: "include",
        });
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("Non-JSON response from get_categories.php");
        }
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

  // ============================================
  // FETCH EXISTING LISTING (EDIT MODE)
  // ============================================
  useEffect(() => {
    if (!isEdit || !id) return;

    let ignore = false;
    async function loadExistingListing() {
      try {
        setLoadingExisting(true);
        setLoadError(null);
        setServerMsg(null);

        const res = await fetch(`${API_BASE}/viewProduct.php?product_id=${encodeURIComponent(id)}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to load listing: HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data || !data.product_id) {
          throw new Error("Invalid listing data received");
        }

        if (ignore) return;

        // Populate form fields
        setTitle(data.title || "");
        
        // Handle categories (can be tags array or categories JSON)
        let cats = [];
        if (Array.isArray(data.tags)) {
          cats = data.tags;
        } else if (data.categories) {
          try {
            const parsed = typeof data.categories === 'string' 
              ? JSON.parse(data.categories) 
              : data.categories;
            if (Array.isArray(parsed)) {
              cats = parsed;
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
          let proxiedUrl = url;
          if (/^https?:\/\//i.test(raw)) {
            proxiedUrl = `${API_BASE}/image.php?url=${encodeURIComponent(raw)}`;
          } else if (raw.startsWith('/data/images/') || raw.startsWith('/images/')) {
            proxiedUrl = `${API_BASE}/image.php?url=${encodeURIComponent(raw)}`;
          } else if (raw.startsWith("/")) {
            proxiedUrl = `${PUBLIC_BASE}${raw}`;
          }
          
          return {
            file: null, // No file object for existing images
            url: proxiedUrl,
            originalUrl: url, // Store original URL for submission
          };
        });
        setImages(imageObjects);

        setSelectedCategory("");
        setErrors({}); // This already clears all errors including images
      } catch (e) {
        if (!ignore) {
          console.error("Error loading existing listing:", e);
          setLoadError(e?.message || "Failed to load listing data.");
          setServerMsg(e?.message || "Failed to load listing data.");
        }
      } finally {
        if (!ignore) {
          setLoadingExisting(false);
        }
      }
    }

    loadExistingListing();
    return () => {
      ignore = true;
    };
  }, [id, isEdit, API_BASE, PUBLIC_BASE]);

  // ============================================
  // MODE-AWARE RESET (NEW MODE)
  // ============================================
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
      setServerMsg(null);
      setLoadError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // ============================================
  // INPUT HANDLER
  // ============================================
  const handleInputChange = (field, value, setter) => {
    if (field === "title" && value.length > LIMITS.title) return;
    if (field === "description" && value.length > LIMITS.description) return;
    // For price, only validate numeric limit if value is not empty and is a valid number
    if (field === "price" && value !== "" && !isNaN(parseFloat(value)) && parseFloat(value) > LIMITS.price) return;
    setter(value);
    if (errors[field]) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne[field];
        return ne;
      });
    }
  };

  // ============================================
  // CATEGORY HANDLERS
  // ============================================
  const addCategory = () => {
    if (!selectedCategory) {
      setErrors((p) => ({ ...p, categories: "Select a category" }));
      return;
    }
    if (categories.includes(selectedCategory)) return;
    if (categories.length >= CATEGORIES_MAX) {
      setErrors((p) => ({
        ...p,
        categories: `Select at most ${CATEGORIES_MAX} categories`,
      }));
      return;
    }
    const next = [...categories, selectedCategory];
    setCategories(next);
    setSelectedCategory("");
    setErrors((p) => {
      const ne = { ...p };
      if (next.length && next.length <= CATEGORIES_MAX) delete ne.categories;
      return ne;
    });
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

  // ============================================
  // VALIDATION
  // ============================================
  const validateAll = () => {
    const newErrors = {};

    // XSS PROTECTION: Check for XSS patterns in title and description
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /onclick=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<img[^>]*on/i,
      /<svg[^>]*on/i,
      /vbscript:/i
    ];

    if (!title.trim()) {
      newErrors.title = "Title is required";
    } else if (xssPatterns.some(pattern => pattern.test(title))) {
      newErrors.title = "Invalid characters in title";
    } else if (title.length > LIMITS.title) {
      newErrors.title = `Title must be ${LIMITS.title} characters or fewer`;
    }

    if (!description.trim()) {
      newErrors.description = "Description is required";
    } else if (xssPatterns.some(pattern => pattern.test(description))) {
      newErrors.description = "Invalid characters in description";
    } else if (description.length > LIMITS.description) {
      newErrors.description = `Description must be ${LIMITS.description} characters or fewer`;
    }

    if (price === "") {
      newErrors.price = "Price is required";
    } else if (containsMemePrice(price)) {
      newErrors.price = "The price has a meme input in it. Please try a different price.";
    } else if (Number(price) < LIMITS.priceMin) {
      newErrors.price = `Minimum price is $${LIMITS.priceMin.toFixed(2)}`;
    } else if (Number(price) > LIMITS.price) {
      newErrors.price = `Price must be $${LIMITS.price} or less`;
    }

    if (!categories || categories.length === 0) {
      newErrors.categories = "Select at least one category";
    } else if (categories.length > CATEGORIES_MAX) {
      newErrors.categories = `Select at most ${CATEGORIES_MAX} categories`;
    }

    if (!itemLocation) {
      newErrors.itemLocation = "Select an item location";
    }
    if (!condition || condition === "") {
      newErrors.condition = "Select an item condition";
    }

    if (!images || images.length === 0) {
      newErrors.images = "At least one image is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  // ============================================
  // IMAGE UPLOAD + 1:1 ENFORCEMENT
  // ============================================
  function isAllowedType(f) {
    // Prefer MIME, but fall back to extension if needed
    if (f.type && ALLOWED_MIME.has(f.type)) return true;

    const name = (f.name || "").toLowerCase();
    const ext = ALLOWED_EXTS.has(
      name.slice(name.lastIndexOf(".")) // includes dot
    );
    return ext;
  }

  function onFileChange(e) {
    const files = Array.from(e.target.files || []).slice(0, 1);
    if (!files.length) return;

    const file = files[0];

    // Validate file size
    if (file.size > MAX_BYTES) {
      setErrors((prev) => ({
        ...prev,
        images: "Image is too large. Max size is 2 MB.",
      }));
      e.target.value = null;
      return;
    }

    // Validate file type
    if (!isAllowedType(file)) {
      setErrors((prev) => ({
        ...prev,
        images: "Only JPG/JPEG, PNG, and WEBP images are allowed.",
      }));
      e.target.value = null;
      return;
    }

    // Clear file size and type errors if validation passes
    if (errors.images && (errors.images.includes("Image is too large") || errors.images.includes("Only JPG/JPEG"))) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne.images;
        return ne;
      });
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        const w = img.width;
        const h = img.height;
        if (w === h) {
          // already square
          setImages((prev) => [
            ...prev,
            {
              file,
              url: ev.target.result,
            },
          ]);
          // Clear image error when image is added
          if (errors.images) {
            setErrors((prev) => {
              const ne = { ...prev };
              delete ne.images;
              return ne;
            });
          }
        } else {
          // open cropper
          setCropImageSrc(ev.target.result);
          setCropImgEl(img);
          setPendingFileName(file.name || "image.png");
          setShowCropper(true);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);

    e.target.value = null;
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  // ============================================
  // CROPPER: when preview image loads
  // ============================================
  function handlePreviewImgLoaded() {
    if (!cropImgEl) return;

    const naturalW = cropImgEl.width;
    const naturalH = cropImgEl.height;
    const box = previewBoxSize;

    const scale = Math.min(box / naturalW, box / naturalH);
    const dispW = naturalW * scale;
    const dispH = naturalH * scale;
    const offsetX = (box - dispW) / 2;
    const offsetY = (box - dispH) / 2;

    const di = {
      dx: offsetX,
      dy: offsetY,
      dw: dispW,
      dh: dispH,
      scale,
    };
    setDisplayInfo(di);
    displayInfoRef.current = di;

    const fixedSize = Math.min(dispW, dispH);
    const sel = {
      x: offsetX + (dispW - fixedSize) / 2,
      y: offsetY + (dispH - fixedSize) / 2,
      size: fixedSize,
    };
    setSelection(sel);
    selectionRef.current = sel;
  }

  // ============================================
  // CROPPER: drag start / move / end
  // ============================================
  function startDrag(e) {
    e.preventDefault();
    draggingRef.current = true;
    // Handle both mouse and touch events
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);
    dragStartRef.current = { x: clientX, y: clientY };
    selectionStartRef.current = {
      x: selectionRef.current.x,
      y: selectionRef.current.y,
    };
  }

  function onCropMouseMove(e) {
    if (!draggingRef.current) return;

    const di = displayInfoRef.current;
    const selStart = selectionStartRef.current;
    const dragStart = dragStartRef.current;
    const size = selectionRef.current.size;

    // Handle both mouse and touch events
    const clientX = e.clientX ?? (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY ?? 0);

    let newX = selStart.x + (clientX - dragStart.x);
    let newY = selStart.y + (clientY - dragStart.y);

    const minX = di.dx;
    const minY = di.dy;
    const maxX = di.dx + di.dw - size;
    const maxY = di.dy + di.dh - size;

    if (newX < minX) newX = minX;
    if (newY < minY) newY = minY;
    if (newX > maxX) newX = maxX;
    if (newY > maxY) newY = maxY;

    const newSel = { ...selectionRef.current, x: newX, y: newY };
    selectionRef.current = newSel;
    setSelection(newSel);
  }

  function onCropMouseUp(e) {
    // Prevent default touch behavior
    if (e) {
      e.preventDefault();
    }
    draggingRef.current = false;
  }

  // ============================================
  // CROPPER: confirm
  // ============================================
  function handleCropConfirm() {
    if (!cropImgEl || !cropImageSrc) {
      setShowCropper(false);
      return;
    }

    const di = displayInfoRef.current;
    const sel = selectionRef.current;

    const selXInImg = (sel.x - di.dx) / di.scale;
    const selYInImg = (sel.y - di.dy) / di.scale;
    const selSizeInImg = sel.size / di.scale;

    const canvasSize = 360;
    const canvas = cropCanvasRef.current;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    ctx.drawImage(
      cropImgEl,
      selXInImg,
      selYInImg,
      selSizeInImg,
      selSizeInImg,
      0,
      0,
      canvasSize,
      canvasSize
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setShowCropper(false);
          return;
        }
        const finalFile = new File([blob], pendingFileName, {
          type: "image/png",
        });
        const finalUrl = URL.createObjectURL(blob);

        setImages((prev) => [...prev, { file: finalFile, url: finalUrl }]);

        // Clear image error when cropped image is added
        if (errors.images) {
          setErrors((prev) => {
            const ne = { ...prev };
            delete ne.images;
            return ne;
          });
        }

        setShowCropper(false);
        setCropImageSrc(null);
        setCropImgEl(null);
        setPendingFileName("");
      },
      "image/png",
      1
    );
  }

  function handleCropCancel() {
    setShowCropper(false);
    setCropImageSrc(null);
    setCropImgEl(null);
    setPendingFileName("");
  }

  // ============================================
  // SUBMIT
  // ============================================
  async function publishListing(e) {
    e.preventDefault();
    setServerMsg(null);
    if (!validateAll()) {
      // Scroll to top and show error banner
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowTopErrorBanner(true);
      return;
    }
    // Hide error banner on successful validation
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

    // Separate existing photos (no file) from new uploads (has file)
    const existingPhotoUrls = [];
    images.forEach((img) => {
      if (img?.file) {
        // New upload - add as file
        fd.append(
          "images[]",
          img.file,
          img.file.name || `image_${Date.now()}.png`
        );
      } else if (img?.originalUrl) {
        // Existing photo - store original URL to send back
        existingPhotoUrls.push(img.originalUrl);
      }
    });

    // In edit mode, send existing photos that should be kept
    if (isEdit && existingPhotoUrls.length > 0) {
      existingPhotoUrls.forEach((url) => {
        fd.append("existingPhotos[]", url);
      });
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/seller-dashboard/product_listing.php`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned non-JSON response.");
      }

      if (!data?.ok) {
        setServerMsg(data?.message || data?.error || "Submission failed.");
        return;
      }

      const pid = data?.prod_id ?? data?.product_id ?? null;
      
      if (isEdit) {
        // For edit mode, redirect back to where user came from, or dashboard
        const returnTo = location.state?.returnTo || "/app/seller-dashboard";
        navigate(returnTo);
      } else {
        // For new listings, show success modal
        setCreatedProdId(pid);
        setShowSuccess(true);

        // reset form
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
  }

  const headerText = isEdit ? "Edit Product Listing" : "New Product Listing";
  const selectableOptions = availableCategories.filter(
    (opt) => !categories.includes(opt)
  );

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
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-950/50 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
              Basic Information
            </h2>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Item Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) =>
                    handleInputChange("title", e.target.value, setTitle)
                  }
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.title
                      ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                      : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  }`}
                  placeholder="Enter a descriptive title for your item"
                  maxLength={LIMITS.title}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Be specific and descriptive to attract buyers.
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {title.length}/{LIMITS.title}
                  </p>
                </div>
                {errors.title && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Item Condition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
                    Item Condition <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => {
                      setCondition(e.target.value);
                      if (errors.condition) {
                        setErrors((prev) => {
                          const ne = { ...prev };
                          delete ne.condition;
                          return ne;
                        });
                      }
                    }}
                    className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.condition
                        ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    }`}
                  >
                    <option value="" disabled>Select An Option</option>
                    <option>Like New</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                    <option>For Parts</option>
                  </select>
                  {errors.condition && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.condition}
                    </p>
                  )}
                </div>
              </div>

              {/* Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Categories <span className="text-red-500">*</span>
                  </label>

                  <div className="flex flex-col gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        // Automatically add the selected category
                        setSelectedCategory(selected);
                        // Check if already added
                        if (categories.includes(selected)) {
                          setSelectedCategory("");
                          return;
                        }
                        // Check max limit
                        if (categories.length >= CATEGORIES_MAX) {
                          setErrors((p) => ({
                            ...p,
                            categories: `Select at most ${CATEGORIES_MAX} categories`,
                          }));
                          setSelectedCategory("");
                          return;
                        }
                        // Add the category
                        const next = [...categories, selected];
                        setCategories(next);
                        setSelectedCategory("");
                        setErrors((p) => {
                          const ne = { ...p };
                          if (next.length && next.length <= CATEGORIES_MAX) delete ne.categories;
                          return ne;
                        });
                      } else {
                        setSelectedCategory("");
                        if (errors.categories) {
                          setErrors((p) => {
                            const ne = { ...p };
                            delete ne.categories;
                            return ne;
                          });
                        }
                      }
                    }}
                    className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.categories
                        ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    }`}
                  >
                    <option value="" disabled>Select An Option</option>
                    {catLoading && <option disabled>Loading...</option>}
                    {!catLoading && selectableOptions.length === 0 && (
                      <option disabled>
                        {catFetchError || "No categories available"}
                      </option>
                    )}
                    {selectableOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  {/* Selected chips */}
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-2 bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-100 rounded-full px-3 py-1"
                      >
                        <span className="text-sm font-medium">{c}</span>
                        <button
                          type="button"
                          aria-label={`remove ${c}`}
                          onClick={() => removeCategory(c)}
                          className="text-blue-600 dark:text-blue-200 hover:text-blue-800 dark:hover:text-white"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Select up to {CATEGORIES_MAX}.
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {categories.length}/{CATEGORIES_MAX}
                    </p>
                  </div>
                </div>

                  {errors.categories && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                      {errors.categories}
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) =>
                    handleInputChange(
                      "description",
                      e.target.value,
                      setDescription
                    )
                  }
                  rows={6}
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                    errors.description
                      ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                      : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  }`}
                  placeholder="Describe your item in detail. Include any relevant information about its condition, usage, or history."
                  maxLength={LIMITS.description}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Provide detailed information about your item.
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    {description.length}/{LIMITS.description}
                  </p>
                </div>
                {errors.description && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location & Pricing */}
          <div className="bg-white dark:bg-gray-950/50 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
              Location & Pricing
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item Location */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Item Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={itemLocation}
                  onChange={(e) => {
                    setItemLocation(e.target.value);
                    if (errors.itemLocation) {
                      setErrors((prev) => {
                        const ne = { ...prev };
                        delete ne.itemLocation;
                        return ne;
                      });
                    }
                  }}
                  className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.itemLocation
                      ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                      : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                  }`}
                >
                  <option value="" disabled>Select An Option</option>
                  {MEET_LOCATION_OPTIONS.filter((opt) => opt.value !== "").map((opt) => (
                    <option key={opt.value || "unselected"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {errors.itemLocation && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.itemLocation}
                  </p>
                )}
              </div>

              {/* Price */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
                    $
                  </span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Store raw string value to preserve exact user input
                      // Only convert to number when needed (validation/submission)
                      handleInputChange("price", value, setPrice);
                    }}
                    className={`w-full pl-8 pr-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.price
                        ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                        : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                    }`}
                    step="0.01"
                    min={LIMITS.priceMin}
                    max={LIMITS.price}
                    placeholder="0.00"
                  />
                </div>
                {errors.price && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                    {errors.price}
                  </p>
                )}
              </div>
            </div>

            {/* Pricing Options */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                <div>
                  <label className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Accepting Trades
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Open to trade offers for your item
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={acceptTrades}
                  onChange={() => setAcceptTrades((s) => !s)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                <div>
                  <label className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Price Negotiable
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Willing to negotiate on price
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={priceNegotiable}
                  onChange={() => setPriceNegotiable((s) => !s)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Photos */}
            <div className={`bg-white dark:bg-gray-950/30 rounded-2xl shadow-sm border p-6 mt-6 ${
              errors.images
                ? "border-red-500 dark:border-red-600"
                : "border-gray-200 dark:border-gray-800"
            }`}>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">
                Photos <span className="text-red-500">*</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                {images.length ? (
                  images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.url}
                        alt={`preview-${i}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 text-sm"
                    >
                      No photo
                    </div>
                  ))
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className={`w-full py-4 px-6 border-2 border-dashed rounded-lg font-medium transition-colors ${
                  errors.images
                    ? "border-red-500 dark:border-red-600 text-red-600 dark:text-red-400 hover:border-red-600 dark:hover:border-red-500"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-200 hover:border-blue-500 hover:text-blue-600"
                }`}
              >
                + Add Photos
              </button>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
                All photos are displayed as squares. You can adjust the crop area when uploading.
              </p>
              {errors.images && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-2 text-center">
                  {errors.images}
                </p>
              )}
            </div>

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
                  onClick={publishListing}
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
          </div>
        </div>
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
                onClick={() => navigate("/app/seller-dashboard")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Go back to Dashboard
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
