// src/components/ItemCardNew.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { withFallbackImage } from "../utils/imageFallback";

export default function ItemCardNew({
  id,
  title,
  price,
  tags,
  image,
  status,
  seller,
  sellerUsername,
  sellerEmail,
  isWishlisted = false,
  fixedWidth = false,
  showRemoveButton = false,
  onRemoveFromWishlist = null,
}) {
  const navigate = useNavigate();
  const isNew =
    typeof status === "string" && status.toUpperCase().includes("JUST");

  const primaryTag =
    Array.isArray(tags) && tags.length > 0 ? String(tags[0]) : null;
  const imageSrc = withFallbackImage(image);

  const handleClick = () => {
    if (!id) return;
    // Prefer param route to avoid full page reload
    navigate(`/app/viewProduct/${encodeURIComponent(id)}`);
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation(); // Prevent card click navigation
    if (onRemoveFromWishlist && id) {
      onRemoveFromWishlist(id, title);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200/90 dark:border-gray-700/70 overflow-hidden
                 ${fixedWidth ? 'w-[240px]' : 'w-full'} h-[350px] cursor-pointer transition-all duration-200
                 hover:shadow-xl hover:-translate-y-1`}
    >
      {/* subtle top accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>

      {/* IMAGE */}
      <div className="relative w-full aspect-square bg-gray-50 dark:bg-gray-700 flex justify-center items-center overflow-hidden">
        <img
          src={imageSrc}
          alt={title}
          className="object-contain w-full h-full p-2 transition-transform duration-200 group-hover:scale-[1.03]"
        />

        {/* Remove button - only shown on wishlist page, top-right corner */}
        {showRemoveButton && (
          <button
            onClick={handleRemoveClick}
            className="absolute top-2 right-2 z-30 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg transition-colors"
            aria-label="Remove from wishlist"
            title="Remove from wishlist"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* NEW badge - positioned below remove button if present */}
        {isNew && (
          <div className={`absolute z-20 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow ${
            showRemoveButton ? "top-10 right-2" : "top-2 right-2"
          }`}>
            NEW
          </div>
        )}

        {/* Wishlisted badge - underneath NEW if present, or below remove button */}
        {isWishlisted && !showRemoveButton && (
          <div className={`absolute z-20 bg-purple-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow flex items-center gap-1 ${
            isNew ? "top-8 right-2" : "top-2 right-2"
          }`}>
            <span>Wishlisted</span>
            <svg
              className="w-3 h-3 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}

        {/* Tag chip */}
        {primaryTag && (
          <div className="absolute bottom-2 left-2 bg-white/95 dark:bg-gray-900/90 text-[10px] font-medium text-gray-800 dark:text-gray-100 px-2 py-0.5 rounded-full border border-gray-100/50">
            {primaryTag}
          </div>
        )}

        {/* dim overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
      </div>

      {/* BODY */}
      <div className="flex flex-col gap-0.5 px-3 py-2 min-w-0">
        {/* title */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 break-words overflow-hidden">
          {title}
        </h3>

        {/* seller */}
        {seller ? (
          <p className="text-[11px] text-gray-500 dark:text-gray-300 flex items-center gap-1 min-w-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
            <span className="truncate">Sold by {seller}</span>
          </p>
        ) : null}

        {/* price */}
        <p className="text-lg font-bold text-gray-900 dark:text-gray-50 mt-0.5">
          {typeof price === "string"
            ? price
            : `$${price?.toFixed?.(2) ?? price ?? "0.00"}`}
        </p>
      </div>

      {/* bottom gradient accent */}
      <div className="absolute inset-x-0 bottom-0 h-9 bg-gradient-to-r from-blue-50 via-transparent to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
    </div>
  );
}
