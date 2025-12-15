// src/pages/Wishlist/WishlistPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ItemCardNew from "../../components/ItemCardNew";
import { apiGet, apiPost, getApiBase } from "../../utils/api";
import { useModal } from "../../hooks/useModal";

export default function WishlistPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]); // Store all items for filtering
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // { id, title } or null
  const [removing, setRemoving] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { isOpen: isMobileFiltersOpen, open: openMobileFilters, close: closeMobileFilters } = useModal(false);

  // Sync mobile filters modal state
  useEffect(() => {
    if (showMobileFilters) {
      openMobileFilters();
    } else {
      closeMobileFilters();
    }
  }, [showMobileFilters, openMobileFilters, closeMobileFilters]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const json = await apiGet("wishlist/get_wishlist.php", {
          signal: controller.signal,
        });
        if (json.success && Array.isArray(json.data)) {
          // Normalize items for ItemCardNew component
          const normalized = json.data.map((d) => {
            const priceNum =
              typeof d.price === "number"
                ? d.price
                : parseFloat(`${d.price}`.replace(/[^0-9.]/g, "")) || 0;

            const rawImg = d.image_url || null;
            const img = rawImg
              ? `${getApiBase()}/media/image.php?url=${encodeURIComponent(rawImg)}`
              : null;

            const createdAt = d.created_at || d.date_listed ? new Date(d.created_at || d.date_listed) : null;
            let status = d.status || null;
            if (!status && createdAt instanceof Date && !isNaN(createdAt)) {
              const hours = (Date.now() - createdAt.getTime()) / 36e5;
              status = hours < 48 ? "JUST POSTED" : "AVAILABLE";
            }

            const tags = Array.isArray(d.tags)
              ? d.tags
              : Array.isArray(d.categories)
              ? d.categories
              : typeof d.tags === "string"
              ? d.tags.split(",").map((t) => t.trim()).filter(Boolean)
              : [];

            const sellerEmail = d.email || d.seller_email || null;
            const sellerUsername = d.seller_username || (sellerEmail ? sellerEmail.split("@")[0] : null);
            return {
              id: d.product_id,
              title: d.title || "Untitled",
              price: priceNum,
              img,
              tags,
              status: status || "AVAILABLE",
              seller: d.seller || "Unknown Seller",
              sellerUsername,
              sellerEmail,
            };
          });
          setAllItems(normalized);
          setItems(normalized);
        } else {
          setAllItems([]);
          setItems([]);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("get_wishlist failed:", e);
          setError(e?.message || "Failed to load wishlist");
          setAllItems([]);
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // Extract unique categories from wishlist items
  const wishlistCategories = useMemo(() => {
    const categoriesSet = new Set();
    allItems.forEach((item) => {
      if (Array.isArray(item.tags)) {
        item.tags.forEach((tag) => {
          if (tag && typeof tag === 'string') {
            categoriesSet.add(tag);
          }
        });
      }
    });
    return Array.from(categoriesSet).sort();
  }, [allItems]);

  // Filter items by selected category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return allItems;
    return allItems.filter((item) => {
      const itemTags = Array.isArray(item.tags) ? item.tags.map((t) => String(t).toLowerCase()) : [];
      return itemTags.includes(selectedCategory.toLowerCase());
    });
  }, [allItems, selectedCategory]);

  // Update displayed items when filter changes
  useEffect(() => {
    setItems(filteredItems);
  }, [filteredItems]);


  // Handle remove from wishlist
  const handleRemoveFromWishlist = (itemId, itemTitle) => {
    setConfirmRemove({ id: itemId, title: itemTitle });
  };

  const confirmRemoveItem = async () => {
    if (!confirmRemove || !confirmRemove.id) return;

    setRemoving(true);
    try {
      const json = await apiPost("wishlist/remove_from_wishlist.php", {
        product_id: Number(confirmRemove.id),
      });
      if (json.success) {
        // Remove item from local state
        setAllItems((prev) => {
          const updated = prev.filter((item) => item.id !== confirmRemove.id);
          
          // Check if we need to reset the filter to "All"
          if (selectedCategory) {
            const remainingInCategory = updated.filter((item) => {
              const itemTags = Array.isArray(item.tags) ? item.tags.map((t) => String(t).toLowerCase()) : [];
              return itemTags.includes(selectedCategory.toLowerCase());
            });
            
            // If no items remain in the selected category, reset to "All"
            if (remainingInCategory.length === 0) {
              setSelectedCategory(null);
            }
          }
          
          return updated;
        });
        setItems((prev) => prev.filter((item) => item.id !== confirmRemove.id));
        setConfirmRemove(null);
      } else {
        throw new Error(json.error || "Failed to remove from wishlist");
      }
    } catch (e) {
      console.error("Remove from wishlist failed:", e);
      setError(e?.message || "Failed to remove from wishlist");
      setConfirmRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  const cancelRemove = () => {
    setConfirmRemove(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full px-1 sm:px-2 md:px-3 py-5 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[0.22fr,1fr] gap-3 items-start">
          {/* LEFT - Quick Filters */}
          {allItems.length > 0 ? (
            <aside className="hidden lg:flex flex-col gap-3 sticky top-20 lg:-ml-3">
              <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Quick filters
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-1.5 rounded-full text-sm border ${
                      selectedCategory === null
                        ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    All
                  </button>
                  {wishlistCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-sm border ${
                        selectedCategory === cat
                          ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700"
                          : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </aside>
          ) : (
            <aside className="hidden lg:block" aria-hidden="true"></aside>
          )}

          {/* CENTER - Heading */}
          <div className="flex flex-col gap-6 min-w-0">
            <div className="mb-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                  My Wishlist
                </h1>
                {/* Mobile Filter Button */}
                {allItems.length > 0 && (
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle filters"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                      />
                    </svg>
                    <span className="text-sm font-medium">Filters</span>
                  </button>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                {selectedCategory 
                  ? `Items in ${selectedCategory}`
                  : "Items you've saved for later"}
                {selectedCategory && ` (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
              </p>
            </div>
          </div>

          {/* Empty State - Spans both columns */}
          {!loading && !error && items.length === 0 && (
            <div className="w-full flex flex-col items-center justify-center text-center py-12 mx-auto lg:col-start-1 lg:col-span-2">
              <svg
                className="mx-auto h-24 w-24 text-gray-400 dark:text-gray-500 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
                {selectedCategory 
                  ? `No items in ${selectedCategory}`
                  : "Your wishlist is empty"}
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                {selectedCategory
                  ? "Try selecting a different category or clear the filter."
                  : "Start adding items you're interested in!"}
              </p>
              {!selectedCategory && (
                <button
                  onClick={() => navigate("/app")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Browse Items
                </button>
              )}
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Show All Items
                </button>
              )}
            </div>
          )}

          {/* Content Area - Loading, Error, or Items Grid */}
          {(loading || error || items.length > 0) && (
            <main className="flex flex-col gap-6 min-w-0 lg:col-start-2">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400 text-lg">Loading wishlist...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-red-600 dark:text-red-400 text-lg">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                  {items.map((item) => (
                    <ItemCardNew
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      price={item.price}
                      tags={item.tags}
                      image={item.img}
                      status={item.status}
                      seller={item.seller}
                      sellerUsername={item.sellerUsername}
                      sellerEmail={item.sellerEmail}
                      isWishlisted={true}
                      showRemoveButton={true}
                      onRemoveFromWishlist={handleRemoveFromWishlist}
                    />
                  ))}
                </div>
              )}
            </main>
          )}
        </div>
      </div>

      {/* Mobile Filter Panel */}
      {showMobileFilters && allItems.length > 0 && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setShowMobileFilters(false)}
          />
          {/* Filter Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Quick filters
              </h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close filters"
              >
                <svg
                  className="w-6 h-6"
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
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setShowMobileFilters(false);
                  }}
                  className={`px-4 py-2 rounded-full text-sm border ${
                    selectedCategory === null
                      ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  }`}
                >
                  All
                </button>
                {wishlistCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowMobileFilters(false);
                    }}
                    className={`px-4 py-2 rounded-full text-sm border ${
                      selectedCategory === cat
                        ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-confirm-title"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full">
            <h2
              id="remove-confirm-title"
              className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4"
            >
              Remove from Wishlist?
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to remove <strong>"{confirmRemove.title}"</strong> from your wishlist?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelRemove}
                disabled={removing}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveItem}
                disabled={removing}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {removing ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

