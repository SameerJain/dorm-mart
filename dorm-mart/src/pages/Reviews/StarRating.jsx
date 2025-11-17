import React from "react";

/**
 * StarRating Component
 *
 * A reusable star rating component that supports:
 * - Half-star increments (0.5)
 * - Both interactive (editable) and read-only modes
 * - Click-based rating selection
 * - Visual feedback with hover effects
 * - Synchronized numeric input
 *
 * @param {number} rating - Current rating value (0-5)
 * @param {function} onRatingChange - Callback when rating changes
 * @param {boolean} readOnly - If true, disables interaction
 * @param {number} size - Size of stars in pixels (default: 32)
 */
function StarRating({
  rating = 0,
  onRatingChange = null,
  readOnly = false,
  size = 32,
}) {
  const [hoveredRating, setHoveredRating] = React.useState(null);

  const handleStarClick = (starValue) => {
    if (readOnly || !onRatingChange) return;
    onRatingChange(starValue);
  };

  const handleStarHover = (starValue) => {
    if (readOnly) return;
    setHoveredRating(starValue);
  };

  const handleMouseLeave = () => {
    setHoveredRating(null);
  };

  const displayRating = hoveredRating !== null ? hoveredRating : rating;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fullStarValue = starIndex;
        const halfStarValue = starIndex - 0.5;
        const isFull = displayRating >= fullStarValue;
        const isHalf = displayRating >= halfStarValue && displayRating < fullStarValue;

        return (
          <div
            key={starIndex}
            className="relative inline-block"
            style={{ width: size, height: size, verticalAlign: 'middle' }}
            onMouseLeave={handleMouseLeave}
          >
            {/* Base star (always rendered) */}
            <div className="absolute inset-0">
              <Star filled={false} size={size} />
            </div>

            {/* Filled overlay for full or half stars */}
            {(isFull || isHalf) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: isFull ? "none" : "inset(0 50% 0 0)",
                }}
              >
                <Star filled={true} size={size} />
              </div>
            )}

            {/* Clickable left half for 0.5 rating */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleStarClick(halfStarValue)}
                onMouseEnter={() => handleStarHover(halfStarValue)}
                className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-pointer opacity-0"
                aria-label={`Rate ${halfStarValue} stars`}
              />
            )}

            {/* Clickable right half for full rating */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleStarClick(fullStarValue)}
                onMouseEnter={() => handleStarHover(fullStarValue)}
                className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-pointer opacity-0"
                aria-label={`Rate ${fullStarValue} stars`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Individual Star Component
 * Renders a single star with filled/empty states
 */
function Star({ filled, size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block"
      style={{ display: 'block', verticalAlign: 'middle' }}
    >
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={filled ? "#fbbf24" : "#e5e7eb"}
        stroke="#fbbf24"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default StarRating;
