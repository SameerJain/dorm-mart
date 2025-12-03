// src/components/ItemCardNew.jsx
import React from "react";
import { withFallbackImage } from "../utils/imageFallback";

export default function ItemCardNew({
  title,
  price,
  seller,
  rating,
  location,
  tags,
  image,
  status,      // we will still accept it, but render as "NEW" chip in top-right
}) {
  // determine if we should show "NEW"
  const isNew =
    typeof status === "string" &&
    status.toUpperCase().includes("JUST"); // matches "JUST POSTED"

  const imageSrc = withFallbackImage(image);

  return (
    <div
      className="relative flex flex-col justify-between bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden
                 w-[210px] h-[340px] p-3 transition-transform hover:scale-[1.02]"
    >
      {/* NEW badge (top-right) */}
      {isNew && (
        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow">
          NEW
        </div>
      )}

      {/* Image */}
      <div className="flex justify-center items-center h-[150px] bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
        <img
          src={imageSrc}
          alt={title}
          className="object-cover w-full h-full"
        />
      </div>

      {/* Details */}
      <div className="flex flex-col flex-grow justify-between mt-3">
        {/* Title + Price */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2 min-h-[40px]">
            {title}
          </h3>
          <div className="mt-2">
            <span className="text-lg font-bold text-gray-900 dark:text-gray-50">
              {typeof price === "string" ? price : `$${price?.toFixed?.(2) ?? price ?? "0.00"}`}
            </span>
          </div>
        </div>

        {/* Seller / Location / Rating */}
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 space-y-1">
          {seller && <div className="flex items-center gap-1">
            <span className="text-xs">👤</span>
            <span className="truncate">{seller}</span>
          </div>}
          {location && <div className="flex items-center gap-1">
            <span className="text-xs">📍</span>
            <span className="truncate">{location}</span>
          </div>}
          {typeof rating === "number" && (
            <div className="flex items-center gap-1">
              <span className="text-xs">⭐</span>
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Tags (max 2 to keep height consistent) */}
        <div className="flex flex-wrap gap-1 mt-2 min-h-[26px]">
          {Array.isArray(tags) &&
            tags.slice(0, 2).map((t, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[10px] rounded-full"
              >
                {t}
              </span>
            ))}
        </div>

        {/* Button */}
        <button
          type="button"
          className="mt-3 w-full bg-indigo-600 text-white text-sm font-medium rounded-md py-2 hover:bg-indigo-700 transition"
        >
          View
        </button>
      </div>
    </div>
  );
}
