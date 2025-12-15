// src/pages/NotificationPage.jsx
import React, { useContext, useMemo, useState, useEffect } from "react";
import { ChatContext } from "../../context/ChatContext";
import { useNavigate } from "react-router-dom";
import { getApiBase, apiPost } from "../../utils/api";

export default function NotificationPage() {
  const ctx = useContext(ChatContext);
  const {
    unreadNotificationsByProduct,
    markAllNotificationsReadLocal,
    markNotificationReadLocal,
  } = ctx || {};

  const navigate = useNavigate(); // for redirecting to viewProduct/:id

  // Normalize object -> array for rendering
  const items = useMemo(() => {
    if (!unreadNotificationsByProduct) return [];
    return Object.entries(unreadNotificationsByProduct)
      .map(([productId, info]) => {
        const count = Number(info?.count ?? 0);
        const title = info?.title ?? `Listing #${productId}`;
        const image_url = info?.image_url ?? null;
        return {
          productId: Number(productId),
          title,
          count,
          image_url,
        };
      })
      .filter((item) => item.count > 0);
  }, [unreadNotificationsByProduct]);

  const [localItems, setLocalItems] = useState([]);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const hasAny = localItems.length > 0;

  function goToProduct(productId) {
    if (!productId) return;
    // Absolute path under /app, matches viewProduct/:id route
    navigate(`/app/viewProduct/${productId}`);
  }

  async function handleMarkAllRead() {
    try {
      await apiPost('wishlist/mark_all_items_read.php', {});

      // Optimistic local UI update
      setLocalItems([]);

      // Also clear the global notification total + map so nav badge updates immediately
      if (typeof markAllNotificationsReadLocal === "function") {
        markAllNotificationsReadLocal();
      }
    } catch (e) {
      console.error("Failed to mark all notifications as read:", e);
      alert("Failed to mark all as read. Please try again.");
    }
  }

  async function handleMarkRead(productId) {
    try {
      await apiPost('wishlist/mark_item_read.php', { product_id: productId });

      // Optimistic local UI update
      setLocalItems((prev) =>
        prev.filter((item) => item.productId !== productId)
      );

      // Decrement the global total + remove from map so nav badge updates
      if (typeof markNotificationReadLocal === "function") {
        markNotificationReadLocal(productId);
      }
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
      alert("Failed to mark as read. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Notifications
            </h1>
            {hasAny && (
              <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Updates from buyers who saved your listings.
              </p>
            )}
          </div>

          {hasAny && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        {!hasAny ? (
          <div className="mt-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-gray-800 shadow-sm mb-3">
              <span className="text-xl">🔔</span>
            </div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              No new wishlist notifications.
            </p>
            <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">
              When buyers add your listings to their wishlist, they’ll appear
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {localItems.map(({ productId, title, count, image_url }) => {
              const rawImg = image_url || null;
              const proxied = rawImg
                ? `${getApiBase()}/media/image.php?url=${encodeURIComponent(String(rawImg))}`
                : null;

              return (
                <div
                  key={productId}
                  className="flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow duration-150"
                >
                  {/* Dot */}
                  <div className="pt-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 flex gap-3">
                    {proxied && (
                      <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <img
                          src={proxied}
                          alt={title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                        <button
                          type="button"
                          onClick={() => goToProduct(productId)}
                          className="text-left hover:underline decoration-blue-500 underline-offset-2"
                        >
                          {title}
                        </button>
                      </h2>

                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        This listing has{" "}
                        <span className="font-semibold">
                          {count} new wishlist {count === 1 ? "save" : "saves"}
                        </span>
                        .
                      </p>

                      <span className="inline-flex mt-1 w-fit items-center rounded-full bg-blue-50 dark:bg-blue-900/40 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-200">
                        Wishlist activity
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleMarkRead(productId)}
                      className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm"
                    >
                      Mark read
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
