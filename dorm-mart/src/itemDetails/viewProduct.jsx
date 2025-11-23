import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChatContext } from "../context/ChatContext";
import { FALLBACK_IMAGE_URL } from "../utils/imageFallback";
import ProfileLink from "../components/ProfileLink";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ViewProduct() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const query = useQuery();
  
  // Check if we came from chat page and should return there
  const returnTo = location.state?.returnTo;

  const productIdFromParams = params.product_id || params.id || null;
  const productIdFromQuery = query.get("product_id") || query.get("id");
  const productId = productIdFromParams || productIdFromQuery || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(null);
  const [myId, setMyId] = useState(null);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState(null);

  const chatCtx = useContext(ChatContext);
  // Try ChatContext first, but also fetch directly as fallback
  const chatMyId = chatCtx?.myId ?? null;

  useEffect(() => {
    setMsgLoading(false);
    setMsgError(null);
  }, [productId]);

  // Fetch user ID directly (fallback if ChatContext not loaded)
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      // Use ChatContext ID if available
      if (chatMyId) {
        setMyId(chatMyId);
        return;
      }
      // Otherwise fetch directly
      try {
        const r = await fetch(`${API_BASE}/auth/me.php`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (r.ok) {
          const json = await r.json();
          if (json.user_id) {
            setMyId(json.user_id);
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          // Silently fail - user might not be logged in
        }
      }
    })();
    return () => controller.abort();
  }, [chatMyId]);

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/viewProduct.php?product_id=${encodeURIComponent(productId)}`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        setData(json || null);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("viewProduct fetch failed:", e);
          setError(e);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [productId]);

  // Check wishlist status when productId or myId changes
  useEffect(() => {
    if (!productId || !myId) {
      setIsInWishlist(false);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/wishlist/check_wishlist_status.php?product_id=${encodeURIComponent(productId)}`, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (json.success) {
          setIsInWishlist(json.in_wishlist || false);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("check_wishlist_status failed:", e);
        }
      }
    })();
    return () => controller.abort();
  }, [productId, myId]);

  const normalized = useMemo(() => {
    if (!data) return null;

    const d = data;
    const title = d.title || d.product_title || "Untitled";
    const description = d.description || d.product_description || "";

    const priceRaw = d.listing_price ?? d.price ?? null;
    const price = typeof priceRaw === "number"
      ? priceRaw
      : priceRaw != null
      ? parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0
      : 0;

    // photos can be JSON array or comma-separated string
    let photos = [];
    if (Array.isArray(d.photos)) photos = d.photos;
    else if (typeof d.photos === "string") {
      try {
        const maybeJson = JSON.parse(d.photos);
        if (Array.isArray(maybeJson)) photos = maybeJson;
        else photos = d.photos.split(",").map((s) => s.trim());
      } catch (_) {
        photos = d.photos.split(",").map((s) => s.trim());
      }
    }
    photos = (photos || []).filter(Boolean);

    // proxy remote images and /data/images/ paths through image.php if present
    const photoUrls = photos.map((p) => {
      const raw = String(p);
      if (/^https?:\/\//i.test(raw)) {
        return `${API_BASE}/image.php?url=${encodeURIComponent(raw)}`;
      }
      // Route /data/images/ and /images/ paths through image.php proxy (like other components)
      if (raw.startsWith('/data/images/') || raw.startsWith('/images/')) {
        return `${API_BASE}/image.php?url=${encodeURIComponent(raw)}`;
      }
      return raw.startsWith("/") ? `${PUBLIC_BASE}${raw}` : raw;
    });
    const normalizedPhotoUrls = photoUrls.length ? photoUrls : [FALLBACK_IMAGE_URL];

    // tags can be JSON array or comma-separated string
    let tags = [];
    if (Array.isArray(d.tags)) tags = d.tags;
    else if (typeof d.tags === "string") {
      try {
        const maybeJson = JSON.parse(d.tags);
        if (Array.isArray(maybeJson)) tags = maybeJson;
        else tags = d.tags.split(",").map((t) => t.trim()).filter(Boolean);
      } catch (_) {
        tags = d.tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }

    const itemLocation = d.item_location || d.meet_location || d.location || null;
    const itemCondition = d.item_condition || d.condition || null;
    const trades = typeof d.trades === "boolean" ? d.trades : String(d.trades || "").toLowerCase() === "1" || String(d.trades || "").toLowerCase() === "true";
    const priceNego = typeof d.price_nego === "boolean" ? d.price_nego : String(d.price_nego || "").toLowerCase() === "1" || String(d.price_nego || "").toLowerCase() === "true";
    const sold = typeof d.sold === "boolean" ? d.sold : String(d.sold || "").toLowerCase() === "1" || String(d.sold || "").toLowerCase() === "true";

    const sellerId = d.seller_id ?? null;
    const sellerName = d.seller || (sellerId != null ? `Seller #${sellerId}` : "Unknown Seller");
    const sellerEmail = d.email || null;
    const sellerUsername = d.seller_username || (sellerEmail ? sellerEmail.split("@")[0] : null);
    const soldTo = d.sold_to ?? null;

    const dateListedStr = d.date_listed || d.created_at || null;
    const dateSoldStr = d.date_sold || null;
    const dateListed = dateListedStr ? new Date(dateListedStr) : null;
    const dateSold = dateSoldStr ? new Date(dateSoldStr) : null;

    return {
      productId: d.product_id ?? d.id ?? null,
      title,
      description,
      price,
      photoUrls: normalizedPhotoUrls,
      tags,
      itemLocation,
      itemCondition,
      trades,
      priceNego,
      sold,
      sellerId,
      sellerName,
      sellerUsername,
      soldTo,
      sellerEmail,
      dateListed,
      dateSold,
      finalPrice: d.final_price ?? null,
    };
  }, [data]);

  useEffect(() => {
    // reset active image if photos change
    setActiveIdx(0);
  }, [normalized?.photoUrls?.length]);

  const hasPrev = activeIdx > 0;
  const hasNext = normalized?.photoUrls && activeIdx < normalized.photoUrls.length - 1;

  // Check if current user is the seller (same condition used for yellow banner and grayed out button)
  const isSellerViewingOwnProduct = myId && normalized?.sellerId && Number(myId) === Number(normalized.sellerId);

  const handleWishlistToggle = async () => {
    if (wishlistLoading || !productId || !myId || isSellerViewingOwnProduct) return;

    setWishlistError(null);
    setWishlistLoading(true);

    try {
      const endpoint = isInWishlist 
        ? `${API_BASE}/wishlist/remove_from_wishlist.php`
        : `${API_BASE}/wishlist/add_to_wishlist.php`;
      
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          product_id: Number(productId),
        }),
      });

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${r.status}`);
      }

      const json = await r.json();
      if (json.success) {
        setIsInWishlist(!isInWishlist);
      } else {
        throw new Error(json.error || "Failed to update wishlist");
      }
    } catch (e) {
      console.error("Wishlist toggle failed:", e);
      setWishlistError(e?.message || "Failed to update wishlist");
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleMessageSeller = async () => {
    if (msgLoading || !normalized?.sellerId) return;

    // Check if user is the seller
    if (isSellerViewingOwnProduct) {
      setMsgError("You are the seller of this item.");
      return;
    }

    setMsgError(null);
    setMsgLoading(true);

    try {
      const payload = {
        product_id: normalized?.productId ?? (productId ? Number(productId) : undefined),
        seller_user_id: normalized?.sellerId ?? undefined,
      };

      const res = await fetch(`${API_BASE}/chat/ensure_conversation.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        const message = result?.error || `Failed to start chat (${res.status})`;
        throw new Error(message);
      }

      if (result.conversation && chatCtx?.registerConversation) {
        chatCtx.registerConversation(result.conversation);
      }

      const convId = result.conversation?.conv_id ?? result.conv_id ?? null;
      const navState = {
        convId,
        receiverId: normalized?.sellerId ?? null,
        receiverName: normalized?.sellerName ?? null,
        autoMessage: result.auto_message ?? null,
      };

      // If we have a returnTo path, use it; otherwise go to chat
      if (returnTo) {
        navigate(returnTo);
      } else {
      navigate("/app/chat", { state: navState });
      }
    } catch (err) {
      console.error("Message seller error", err);
      setMsgError(err?.message || "Unable to open chat.");
    } finally {
      setMsgLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-2 md:px-4 py-3 grid grid-cols-3 items-center relative">
        <div className="flex justify-start">
          <button 
            onClick={() => {
              if (returnTo) {
                navigate(returnTo);
              } else {
                navigate(-1);
              }
            }} 
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back
          </button>
        </div>
        <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">Product Details</h1>
        <div className="flex items-center gap-2 justify-end">
          {isSellerViewingOwnProduct ? (
            <button
              onClick={() => navigate('/app/seller-dashboard')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <span className="hidden sm:inline">View Seller Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
            </button>
          ) : (
            <div className="w-0" />
          )}
        </div>
      </div>
      {wishlistError && normalized && (
        <div className="w-full px-2 md:px-4 py-1">
          <p className="text-xs text-red-600 dark:text-red-400">{wishlistError}</p>
        </div>
      )}

      <div className="w-full px-2 md:px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Loading product…</p>
        ) : error ? (
          <p className="text-center text-sm text-red-500 dark:text-red-400">Couldn't load product.</p>
        ) : !normalized ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">No product found.</p>
        ) : (
          <>
            {isSellerViewingOwnProduct && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-base font-semibold text-yellow-800 dark:text-yellow-200 text-center">You are the seller of this item.</p>
              </div>
            )}
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,1.15fr] gap-3 lg:gap-4 items-start">
            {/* Left: photos */}
            <section className="flex gap-3 items-start justify-center lg:sticky lg:top-20">
              {/* Vertical thumbnails (md+) */}
              {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                <div className="hidden md:flex md:flex-col gap-2 md:max-h-[32rem] overflow-y-auto pr-1">
                  {normalized.photoUrls.map((u, idx) => (
                    <button
                      key={`thumb-${idx}`}
                      onClick={() => setActiveIdx(idx)}
                      className={`h-16 w-16 rounded-md overflow-hidden border bg-white dark:bg-gray-800 ${idx === activeIdx ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-700" : "border-gray-200 dark:border-gray-700"}`}
                    >
                      <img src={u} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Main image card (square) */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm w-full max-w-[28rem] md:max-w-[32rem] aspect-square mx-auto overflow-hidden relative">
                {normalized.photoUrls && normalized.photoUrls.length ? (
                  <img
                    alt={normalized.title}
                    src={normalized.photoUrls[activeIdx]}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">No image</div>
                )}
                {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                  <>
                    <button
                      onClick={() => hasPrev && setActiveIdx((i) => Math.max(0, i - 1))}
                      disabled={!hasPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-full h-9 w-9 flex items-center justify-center disabled:opacity-40"
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => hasNext && setActiveIdx((i) => Math.min((normalized.photoUrls?.length || 1) - 1, i + 1))}
                      disabled={!hasNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-full h-9 w-9 flex items-center justify-center disabled:opacity-40"
                      aria-label="Next image"
                    >
                      ›
                    </button>
                  </>
                ) : null}
              </div>

              {/* Horizontal thumbnails (sm) */}
              {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                <div className="md:hidden absolute -bottom-12 left-0 right-0 flex gap-2 justify-center">
                  {normalized.photoUrls.map((u, idx) => (
                    <button
                      key={`thumb-sm-${idx}`}
                      onClick={() => setActiveIdx(idx)}
                      className={`h-12 w-12 rounded-md overflow-hidden border bg-white dark:bg-gray-800 ${idx === activeIdx ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-700" : "border-gray-200 dark:border-gray-700"}`}
                    >
                      <img src={u} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            {/* Right: details */}
            <section className="flex flex-col gap-4 min-w-0">
              {/* Title */}
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug break-words overflow-hidden">{normalized.title}</h2>

              {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
                  <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">Sold by</span>
                  <ProfileLink
                    username={normalized.sellerUsername}
                    email={normalized.sellerEmail}
                    fallback={normalized.sellerName}
                    className="font-medium text-gray-800 dark:text-gray-200 truncate min-w-0"
                    hoverClass="hover:text-blue-600"
                  >
                    {normalized.sellerName}
                  </ProfileLink>
                {normalized.tags && normalized.tags.length ? (
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                ) : null}
                {normalized.tags && normalized.tags.length ? (
                  <div className="flex flex-wrap gap-1">
                    {normalized.tags.slice(0, 3).map((t, i) => (
                      <span key={`tag-top-${i}`} className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700 rounded-full px-2 py-0.5">{String(t)}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Buy box (Amazon-like, but with our palette and only Message Seller) */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 w-full relative">
                {/* Wishlist button - top right corner */}
                {!isSellerViewingOwnProduct && normalized && (
                  <button
                    onClick={handleWishlistToggle}
                    disabled={wishlistLoading || !myId}
                    className={`absolute top-3 right-3 rounded-full font-medium px-3 py-1.5 flex items-center gap-1.5 text-sm whitespace-nowrap ${isInWishlist ? "bg-purple-600 dark:bg-purple-700 hover:bg-purple-700 dark:hover:bg-purple-600 text-white" : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"} disabled:opacity-50 transition-colors`}
                    title={wishlistLoading ? "Loading..." : isInWishlist ? "Saved to Wishlist" : "Add to Wishlist"}
                  >
                    <svg
                      className={`w-4 h-4 ${isInWishlist ? "fill-current" : ""}`}
                      fill={isInWishlist ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    {wishlistLoading ? (
                      <span className="hidden sm:inline">Loading...</span>
                    ) : isInWishlist ? (
                      <span className="hidden sm:inline">Saved to Wishlist</span>
                    ) : (
                      <span className="hidden sm:inline">Add to Wishlist</span>
                    )}
                  </button>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">${normalized.price?.toFixed(2)}</span>
                  {normalized.priceNego ? (
                  <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-full px-2 py-0.5">Price Negotiable</span>
                  ) : null}
                  {normalized.trades ? (
                    <span className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-full px-2 py-0.5">Open to trades</span>
                  ) : null}
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">{normalized.sold ? 'Not available' : 'In Stock'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pickup: {normalized.itemLocation || 'On campus'}</p>

                <div className="mt-3 space-y-2 flex flex-col items-center">
                  {isSellerViewingOwnProduct ? (
                    <>
                      {/* Prominent buyer perspective notice */}
                      <div className="mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg w-full">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <div>
                            <p className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-1">Buyer's Perspective View</p>
                            <p className="text-base text-yellow-700 dark:text-yellow-300">You're viewing your listing from a buyer's perspective. This helps you see how your item appears to potential buyers.</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/app/product-listing/edit/${normalized.productId}`, { 
                          state: { returnTo: `/app/viewProduct/${normalized.productId}` } 
                        })}
                        className="w-full max-w-xs rounded-full font-medium py-2 bg-blue-800 dark:bg-blue-900 hover:bg-blue-900 dark:hover:bg-blue-800 text-white"
                      >
                        Edit Listing
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleMessageSeller}
                        disabled={!normalized.sellerId || msgLoading}
                        className="w-full max-w-xs rounded-full font-medium py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 text-white"
                      >
                        {msgLoading ? "Opening chat..." : "Message Seller"}
                      </button>
                      {msgError ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{msgError}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              {normalized.description ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">About this item</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words break-all overflow-hidden min-w-0">{normalized.description}</p>
                </div>
              ) : null}

              {/* Detailed info (no duplicates with meta above) */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Detail label="Item location" value={normalized.itemLocation || '—'} />
                  <Detail label="Condition" value={normalized.itemCondition || '—'} />
                  <Detail label="Price Negotiable" value={normalized.priceNego ? 'Yes' : 'No'} />
                  <Detail label="Accepts trades" value={normalized.trades ? 'Yes' : 'No'} />
                  <Detail label="Seller email" value={normalized.sellerEmail ? (<a href={`mailto:${normalized.sellerEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">{normalized.sellerEmail}</a>) : '—'} />
                </div>
                <div className="space-y-2">
                  <Detail label="Date listed" value={normalized.dateListed ? formatDate(normalized.dateListed) : '—'} />
                  {normalized.sold ? (
                    <Detail label="Date sold" value={normalized.dateSold ? formatDate(normalized.dateSold) : '—'} />
                  ) : null}
                  {normalized.sold && normalized.finalPrice != null ? (
                    <Detail label="Final price" value={`$${Number(normalized.finalPrice).toFixed(2)}`} />
                  ) : null}
                </div>
              </div>
            </section>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
    </div>
  );
}

function formatDate(d) {
  try {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch (_) {
    return String(d);
  }
}
