import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChatContext } from "../context/ChatContext";
import { FALLBACK_IMAGE_URL } from "../utils/imageFallback";
import ProfileLink from "../components/ProfileLink";

const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const API_BASE = (process.env.REACT_APP_API_BASE || `${PUBLIC_BASE}/api`).replace(/\/$/, "");

const FAILURE_REASON_LABELS = {
  buyer_no_show: "Buyer no showed",
  insufficient_funds: "Buyer did not have enough money",
  other: "Other",
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ViewReceipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const query = useQuery();

  const returnTo = location.state?.returnTo;

  const productIdFromParams = params.product_id || params.id || null;
  const productIdFromQuery = query.get("product_id") || query.get("id");
  const productId = productIdFromParams || productIdFromQuery || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productData, setProductData] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(null);
  const [myId, setMyId] = useState(null);

  const chatCtx = useContext(ChatContext);
  const chatMyId = chatCtx?.myId ?? null;

  useEffect(() => {
    setMsgLoading(false);
    setMsgError(null);
  }, [productId]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      if (chatMyId) {
        setMyId(chatMyId);
        return;
      }
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
          // ignore
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
        const queryParams = new URLSearchParams();
        if (productId) {
          queryParams.set("product_id", productId);
          queryParams.set("id", productId);
        }
        const endpoint = `${API_BASE}/receipt/view_receipt.php?${queryParams.toString()}`;
        const r = await fetch(endpoint, {
          signal: controller.signal,
          credentials: "include",
        });
        if (!r.ok) {
          // Try to parse error response from API
          let errorMessage = `HTTP ${r.status}`;
          try {
            const contentType = r.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorJson = await r.json();
              console.error('[ViewReceipt] API error response:', errorJson);
              if (errorJson?.error) {
                errorMessage = errorJson.error;
              } else if (errorJson?.message) {
                errorMessage = errorJson.message;
              }
            } else {
              const text = await r.text();
              console.error('[ViewReceipt] Non-JSON error response:', text);
              if (text) {
                errorMessage = text.substring(0, 200); // Limit error message length
              }
            }
          } catch (parseError) {
            // If JSON parsing fails, use default error message
            console.error("[ViewReceipt] Failed to parse error response:", parseError);
          }
          throw new Error(errorMessage);
        }
        const json = await r.json();
        if (!json.success && json.error) {
          throw new Error(json.error);
        }
        const payload = json?.data ?? json ?? null;
        const productPayload = payload?.product ?? payload?.product_details ?? payload?.item ?? payload;
        const receiptPayload =
          payload?.receipt ??
          payload?.receipt_details ??
          payload?.purchase ??
          payload?.purchase_details ??
          payload?.confirmation ??
          payload?.confirm ??
          payload;
        setProductData(productPayload || null);
        setReceiptData(receiptPayload || null);
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("viewReceipt fetch failed:", e);
          setError(e);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [productId]);

  const normalized = useMemo(() => {
    if (!productData) return null;
    const d = productData;
    const title = d.title || d.product_title || "Untitled";
    const description = d.description || d.product_description || "";

    const priceRaw = d.listing_price ?? d.price ?? null;
    const price = typeof priceRaw === "number"
      ? priceRaw
      : priceRaw != null
      ? parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0
      : 0;

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

    const photoUrls = photos.map((p) => {
      const raw = String(p);
      if (/^https?:\/\//i.test(raw)) {
        return `${API_BASE}/image.php?url=${encodeURIComponent(raw)}`;
      }
      if (raw.startsWith("/data/images/") || raw.startsWith("/images/")) {
        return `${API_BASE}/image.php?url=${encodeURIComponent(raw)}`;
      }
      return raw.startsWith("/") ? `${PUBLIC_BASE}${raw}` : raw;
    });
    const normalizedPhotoUrls = photoUrls.length ? photoUrls : [FALLBACK_IMAGE_URL];

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
  }, [productData]);

  useEffect(() => {
    setActiveIdx(0);
  }, [normalized?.photoUrls?.length]);

  const hasPrev = activeIdx > 0;
  const hasNext = normalized?.photoUrls && activeIdx < normalized.photoUrls.length - 1;
  const isSellerViewingOwnProduct = myId && normalized?.sellerId && Number(myId) === Number(normalized.sellerId);

  const purchaseDetails = useMemo(() => {
    if (!receiptData) return null;
    const src = receiptData || {};
    const finalPrice =
      coerceNumber(
        src.final_price ??
          src.finalPrice ??
          src.purchase_price ??
          src.amount_paid ??
          src.price_paid ??
          src.total_paid ??
          src.price
      ) ?? null;
    const negotiatedPrice =
      coerceNumber(
        src.negotiated_price ??
          src.negotiatedPrice ??
          src.agreed_price ??
          src.default_final_price ??
          src.original_price ??
          src.snapshot?.negotiated_price
      ) ?? null;
    const meetingAt = parseDateValue(
      src.meeting_at ??
        src.meetingAt ??
        src.meeting_time ??
        src.met_at ??
        src.meet_at ??
        src.meet_time ??
        src.snapshot?.meeting_at
    );
    const purchaseDate = parseDateValue(
      src.purchase_date ??
        src.purchased_at ??
        src.confirmed_at ??
        src.completed_at ??
        src.closed_at ??
        src.date_sold ??
        src.dateSold ??
        src.snapshot?.meeting_at ??
        normalized?.dateSold ??
        meetingAt ??
        src.buyer_response_at ??
        src.updated_at ??
        src.created_at
    );
    const buyerResponseAt = parseDateValue(src.buyer_response_at ?? src.buyerResponseAt);
    const sellerSubmittedAt = parseDateValue(
      src.seller_submitted_at ?? src.submitted_at ?? src.created_at ?? src.createdAt
    );
    const recordedAt = parseDateValue(src.recorded_at ?? src.updated_at ?? src.updatedAt ?? src.completed_at);
    const failureReason = src.failure_reason ?? src.failureReason ?? src.reason ?? src.reason_code ?? null;
    const failureReasonNotes = src.failure_reason_notes ?? src.failureReasonNotes ?? src.reason_notes ?? null;
    const sellerNotes = src.seller_notes ?? src.sellerNotes ?? src.notes ?? src.description ?? null;
    const buyerNotes = src.buyer_notes ?? src.buyerNotes ?? null;
    const extraComments = src.comments ?? src.additional_comments ?? src.additionalComments ?? null;
    const meetLocation =
      src.meet_location ??
      src.meeting_location ??
      src.location ??
      src.snapshot?.meet_location ??
      normalized?.itemLocation ??
      null;
    const buyerName = src.buyer_name ?? src.buyerName ?? src.snapshot?.buyer_name ?? null;
    const sellerName = src.seller_name ?? src.sellerName ?? normalized?.sellerName ?? null;
    const buyerId = src.buyer_user_id ?? src.buyerUserId ?? src.buyer_id ?? src.snapshot?.buyer_id ?? null;
    const sellerId = src.seller_user_id ?? src.sellerUserId ?? src.seller_id ?? normalized?.sellerId ?? null;
    const tradeItemDescription =
      src.trade_item_description ??
      src.tradeItemDescription ??
      src.snapshot?.trade_item_description ??
      null;
    const isTrade = coerceBoolean(src.is_trade ?? src.trade ?? src.snapshot?.is_trade);
    const receiptId = src.receipt_id ?? src.receiptId ?? null;

    return {
      receiptId,
      finalPrice,
      negotiatedPrice,
      meetLocation,
      meetingAt,
      purchaseDate,
      buyerResponseAt,
      sellerSubmittedAt,
      recordedAt,
      buyerName,
      sellerName,
      buyerId,
      sellerId,
      comments: extraComments,
      sellerNotes,
      buyerNotes,
      failureReason,
      failureReasonLabel: failureReason ? FAILURE_REASON_LABELS[failureReason] ?? humanizeStatus(failureReason) : null,
      failureReasonNotes,
      tradeItemDescription,
      isTrade: isTrade === true,
    };
  }, [receiptData, normalized]);

  const purchaseRows = useMemo(() => buildPurchaseRows(purchaseDetails), [purchaseDetails]);

  const displayedPrice = useMemo(() => {
    if (!normalized) return null;
    if (purchaseDetails?.finalPrice != null) {
      return purchaseDetails.finalPrice;
    }
    return normalized.price ?? null;
  }, [purchaseDetails, normalized]);

  const displayPriceText =
    displayedPrice != null
      ? formatCurrency(displayedPrice) ?? `$${Number(displayedPrice).toFixed(2)}`
      : "—";

  const pageHeading = "Purchase Receipt";

  // Determine transaction status for styling
  const isSuccessful = !purchaseDetails?.failureReason;
  const transactionStatus = isSuccessful ? "Successful" : "Failed";

  const handleMessageSeller = async () => {
    if (msgLoading || !normalized?.sellerId) return;

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
        <h1 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">{pageHeading}</h1>
        <div className="flex items-center gap-2 justify-end">
          {isSellerViewingOwnProduct ? (
            <button
              onClick={() => navigate("/app/seller-dashboard")}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
            >
              View Seller Dashboard
            </button>
          ) : (
            <div className="w-0" />
          )}
        </div>
      </div>
      <div className="w-full px-2 md:px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Loading receipt…</p>
        ) : error ? (
          <div className="text-center">
            <p className="text-sm text-red-500 dark:text-red-400 font-medium mb-2">Couldn't load receipt.</p>
            {error.message && !error.message.startsWith('HTTP ') && (
              <p className="text-xs text-red-400 dark:text-red-500">{error.message}</p>
            )}
            {error.message && error.message.startsWith('HTTP ') && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Error code: {error.message}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Please check your connection and try again.
            </p>
          </div>
        ) : !normalized ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">No product found.</p>
        ) : (
          <>
            {isSellerViewingOwnProduct && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">You are the seller of this item.</p>
              </div>
            )}
            
            {/* Receipt Header Badge */}
            {purchaseDetails && (
              <div className={`mb-6 rounded-xl border-2 shadow-md p-5 ${
                isSuccessful 
                  ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700" 
                  : "bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider ${
                      isSuccessful
                        ? "bg-emerald-600 dark:bg-emerald-700 text-white"
                        : "bg-red-600 dark:bg-red-700 text-white"
                    }`}>
                      Receipt
                    </div>
                    {purchaseDetails.receiptId && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">Receipt Number</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">#{purchaseDetails.receiptId}</p>
                      </div>
                    )}
                  </div>
                  <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                    isSuccessful
                      ? "bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                      : "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200"
                  }`}>
                    {transactionStatus}
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr,1.15fr] gap-6 items-start">
              <section className="flex gap-3 items-start justify-center lg:sticky lg:top-20">
                {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                  <div className="hidden md:flex md:flex-col gap-2 md:max-h-[32rem] overflow-y-auto pr-1">
                    {normalized.photoUrls.map((u, idx) => (
                      <button
                        key={`thumb-${idx}`}
                        onClick={() => setActiveIdx(idx)}
                        className={`h-16 w-16 rounded-md overflow-hidden border bg-white dark:bg-gray-800 ${
                          idx === activeIdx ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-700" : "border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <img src={u} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm w-full max-w-[28rem] md:max-w-[32rem] aspect-square mx-auto overflow-hidden relative">
                  {normalized.photoUrls && normalized.photoUrls.length ? (
                    <img alt={normalized.title} src={normalized.photoUrls[activeIdx]} className="h-full w-full object-contain" />
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

                {normalized.photoUrls && normalized.photoUrls.length > 1 ? (
                  <div className="md:hidden absolute -bottom-12 left-0 right-0 flex gap-2 justify-center">
                    {normalized.photoUrls.map((u, idx) => (
                      <button
                        key={`thumb-sm-${idx}`}
                        onClick={() => setActiveIdx(idx)}
                        className={`h-12 w-12 rounded-md overflow-hidden border bg-white dark:bg-gray-800 ${
                          idx === activeIdx ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-700" : "border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <img src={u} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="flex flex-col gap-4 min-w-0">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug">{normalized.title}</h2>

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
                    <>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <div className="flex flex-wrap gap-1">
                        {normalized.tags.slice(0, 3).map((t, i) => (
                          <span
                            key={`tag-top-${i}`}
                            className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700 rounded-full px-2 py-0.5"
                          >
                            {String(t)}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Purchase Details Section - Moved Higher and Enhanced */}
                {purchaseDetails ? (
                  <div className={`rounded-xl border-2 shadow-lg p-6 w-full ${
                    isSuccessful
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                      <div>
                        <h3 className={`text-xl font-bold ${isSuccessful ? "text-emerald-900 dark:text-emerald-100" : "text-red-900 dark:text-red-100"}`}>
                          Transaction Details
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Complete purchase information</p>
                      </div>
                    </div>

                    {/* Key Receipt Information - Prominently Displayed */}
                    <div className="space-y-4 mb-6">
                      {purchaseDetails.receiptId && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Receipt Number</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">#{purchaseDetails.receiptId}</p>
                        </div>
                      )}
                      
                      {purchaseDetails.purchaseDate && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Purchase Date</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatDateTime(purchaseDetails.purchaseDate)}</p>
                        </div>
                      )}
                      
                      {purchaseDetails.finalPrice != null && (
                        <div className={`rounded-lg p-5 border-2 ${
                          isSuccessful
                            ? "bg-emerald-100 dark:bg-emerald-800/50 border-emerald-300 dark:border-emerald-600"
                            : "bg-red-100 dark:bg-red-800/50 border-red-300 dark:border-red-600"
                        }`}>
                          <p className="text-sm uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-2">Amount Paid</p>
                          <p className={`text-5xl font-bold ${isSuccessful ? "text-emerald-900 dark:text-emerald-100" : "text-red-900 dark:text-red-100"}`}>
                            {formatCurrency(purchaseDetails.finalPrice) ?? `$${Number(purchaseDetails.finalPrice).toFixed(2)}`}
                          </p>
                          {purchaseDetails.negotiatedPrice != null && purchaseDetails.negotiatedPrice !== purchaseDetails.finalPrice && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                              Original: {formatCurrency(purchaseDetails.negotiatedPrice)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Additional Details */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {purchaseRows.filter(row => {
                        // Filter out already displayed fields
                        return row.label !== "Receipt #" && 
                               row.label !== "Purchase date" && 
                               row.label !== "Final price" &&
                               row.label !== "Negotiated price";
                      }).map((row, idx) => (
                        <ReceiptDetail key={`${row.label}-${idx}`} label={row.label} value={row.value} isSuccessful={isSuccessful} />
                      ))}
                    </div>

                    {purchaseDetails.failureReason ? (
                      <div className={`mt-6 p-4 rounded-lg border-2 ${
                        isSuccessful
                          ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                          : "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
                      }`}>
                        <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">Failure Reason</p>
                        <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                          {purchaseDetails.failureReasonLabel || humanizeStatus(purchaseDetails.failureReason)}
                        </p>
                        {purchaseDetails.failureReasonNotes ? (
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-2">{purchaseDetails.failureReasonNotes}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {purchaseDetails.sellerNotes ? <NoteBlock title="Seller notes" text={purchaseDetails.sellerNotes} isSuccessful={isSuccessful} /> : null}
                    {purchaseDetails.buyerNotes ? <NoteBlock title="Buyer comments" text={purchaseDetails.buyerNotes} isSuccessful={isSuccessful} /> : null}
                    {purchaseDetails.comments ? <NoteBlock title="Additional comments" text={purchaseDetails.comments} isSuccessful={isSuccessful} /> : null}
                  </div>
                ) : null}

                {/* Price Display Box - Only shown when no purchase details exist */}
                {!purchaseDetails && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm p-4 w-full max-w-md">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{displayPriceText}</span>
                      {normalized.priceNego ? (
                        <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-full px-2 py-0.5">
                          Price Negotiable
                        </span>
                      ) : null}
                      {normalized.trades ? (
                        <span className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-full px-2 py-0.5">
                          Open to trades
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">{normalized.sold ? "Not available" : "In Stock"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Pickup: {normalized.itemLocation || "On campus"}</p>

                    <div className="mt-3 space-y-2">
                      <button
                        onClick={handleMessageSeller}
                        disabled={!normalized.sellerId || msgLoading || isSellerViewingOwnProduct}
                        className={`w-full rounded-full font-medium py-2 ${
                          isSellerViewingOwnProduct
                            ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white"
                            : "bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 text-white"
                        }`}
                      >
                        {msgLoading ? "Opening chat..." : "Message Seller"}
                      </button>
                      {msgError ? <p className="text-xs text-red-600 dark:text-red-400">{msgError}</p> : null}
                    </div>
                  </div>
                )}

                {normalized.description ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">About this item</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{normalized.description}</p>
                  </div>
                ) : null}

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Detail label="Item location" value={normalized.itemLocation || "—"} />
                    <Detail label="Condition" value={normalized.itemCondition || "—"} />
                    <Detail label="Price Negotiable" value={normalized.priceNego ? "Yes" : "No"} />
                    <Detail label="Accepts trades" value={normalized.trades ? "Yes" : "No"} />
                    <Detail
                      label="Seller email"
                      value={
                        normalized.sellerEmail ? (
                          <a href={`mailto:${normalized.sellerEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline truncate inline-block max-w-full" title={normalized.sellerEmail}>
                            {normalized.sellerEmail}
                          </a>
                        ) : (
                          "—"
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Detail label="Date listed" value={normalized.dateListed ? formatDate(normalized.dateListed) : "—"} />
                    {normalized.sold ? <Detail label="Date sold" value={normalized.dateSold ? formatDate(normalized.dateSold) : "—"} /> : null}
                    {normalized.sold && normalized.finalPrice != null ? <Detail label="Final price" value={`$${Number(normalized.finalPrice).toFixed(2)}`} /> : null}
                  </div>
                </div>

                <div className="pt-1">
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
                    Back to results
                  </button>
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
    <div className="flex items-start gap-2">
      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 pt-0.5 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300 min-w-0 flex-1 truncate">{value ?? "—"}</span>
    </div>
  );
}

function ReceiptDetail({ label, value, isSuccessful }) {
  // Special handling for buyer/seller names to make them bolder
  const isNameField = label === "Buyer" || label === "Seller";
  
  return (
    <div className={`p-3 rounded-lg border ${
      isSuccessful
        ? "bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-700"
        : "bg-white dark:bg-gray-800 border-red-200 dark:border-red-700"
    }`}>
      <p className={`text-xs uppercase tracking-wide mb-1 ${
        isSuccessful ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
      }`}>
        {label}
      </p>
      <p className={`${isNameField ? "text-base font-bold" : "text-sm font-semibold"} text-gray-900 dark:text-gray-100 break-words`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function NoteBlock({ title, text, isSuccessful }) {
  if (!text) return null;
  return (
    <div className={`mt-6 p-4 rounded-lg border ${
      isSuccessful
        ? "bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-700"
        : "bg-white dark:bg-gray-800 border-red-200 dark:border-red-700"
    }`}>
      <p className={`text-xs uppercase tracking-wide mb-2 ${
        isSuccessful ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
      }`}>
        {title}
      </p>
      <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">{text}</p>
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

function formatDateTime(d) {
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (_) {
    return String(d);
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function parseDateValue(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const dateFromNumber = new Date(value);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
    let attempt = new Date(normalized);
    if (Number.isNaN(attempt.getTime())) {
      attempt = new Date(`${trimmed}Z`);
    }
    return Number.isNaN(attempt.getTime()) ? null : attempt;
  }
  return null;
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

function coerceBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["1", "true", "yes", "y", "completed", "success", "successful"].includes(normalized)) return true;
    if (["0", "false", "no", "n", "failed"].includes(normalized)) return false;
  }
  return null;
}

function humanizeStatus(input) {
  if (!input && input !== 0) return "";
  const raw = String(input).replace(/[_-]+/g, " ").trim();
  if (!raw) return "";
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPurchaseRows(details) {
  if (!details) return [];
  const rows = [];
  const addRow = (label, value, options = {}) => {
    const { showPlaceholder = false, placeholder = "—" } = options;
    if (value === null || value === undefined || value === "") {
      if (showPlaceholder) {
        rows.push({ label, value: placeholder });
      }
      return;
    }
    rows.push({ label, value });
  };

  addRow("Receipt #", details.receiptId ? `#${details.receiptId}` : null, { showPlaceholder: true });
  addRow("Purchase date", details.purchaseDate ? formatDateTime(details.purchaseDate) : null, { showPlaceholder: true });
  addRow("Meeting location", details.meetLocation || null, { showPlaceholder: true });
  addRow("Final price", details.finalPrice != null ? formatCurrency(details.finalPrice) : null);
  if (details.negotiatedPrice != null && details.negotiatedPrice !== details.finalPrice) {
    addRow("Negotiated price", formatCurrency(details.negotiatedPrice));
  }
  addRow(
    "Buyer",
    details.buyerName || (details.buyerId ? `Buyer #${details.buyerId}` : null),
    { showPlaceholder: true }
  );
  addRow(
    "Seller",
    details.sellerName || (details.sellerId ? `Seller #${details.sellerId}` : null),
    { showPlaceholder: true }
  );
  addRow("Trade item", details.tradeItemDescription || (details.isTrade ? "Trade involved" : null));

  return rows;
}
