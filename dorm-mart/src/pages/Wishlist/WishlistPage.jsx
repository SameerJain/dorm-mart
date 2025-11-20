// src/pages/Wishlist/WishlistPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ItemCardNew from "../../components/ItemCardNew";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

export default function WishlistPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]); // Store all items for filtering
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/wishlist/get_wishlist.php`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (json.success && Array.isArray(json.data)) {
          // Normalize items for ItemCardNew component
          const normalized = json.data.map((d) => {
            const priceNum =
              typeof d.price === "number"
                ? d.price
                : parseFloat(`${d.price}`.replace(/[^0-9.]/g, "")) || 0;

            const rawImg = d.image_url || null;
            const img = rawImg
              ? `${API_BASE}/image.php?url=${encodeURIComponent(rawImg)}`
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full px-1 sm:px-2 md:px-3 py-5 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[0.22fr,1fr] gap-3 items-start">
          {/* LEFT - Quick Filters */}
          <aside className="hidden lg:flex flex-col gap-3 sticky top-20">
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

          {/* CENTER - Wishlist Items */}
          <main className="flex flex-col gap-6 min-w-0">
            <div className="mb-4">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                My Wishlist
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {selectedCategory 
                  ? `Items in ${selectedCategory}`
                  : "Items you've saved for later"}
                {selectedCategory && ` (${items.length} ${items.length === 1 ? 'item' : 'items'})`}
              </p>
            </div>

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
            ) : items.length === 0 ? (
              <div className="text-center py-12">
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
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

