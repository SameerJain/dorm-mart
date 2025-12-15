import { LIMITS } from "../utils/validation";

/**
 * Product form fields component
 */
export default function ProductFormFields({
  title,
  setTitle,
  condition,
  setCondition,
  itemLocation,
  setItemLocation,
  description,
  setDescription,
  price,
  setPrice,
  acceptTrades,
  setAcceptTrades,
  priceNegotiable,
  setPriceNegotiable,
  categories,
  availableCategories,
  selectedCategory,
  setSelectedCategory,
  addCategory,
  removeCategory,
  errors,
  setErrors,
  handleInputChange,
  MEET_LOCATION_OPTIONS,
}) {
  return (
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
                <option>Poor</option>
              </select>
              {errors.condition && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {errors.condition}
                </p>
              )}
            </div>

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
                {MEET_LOCATION_OPTIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {errors.itemLocation && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {errors.itemLocation}
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
                handleInputChange("description", e.target.value, setDescription)
              }
              rows={6}
              className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                errors.description
                  ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                  : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              }`}
              placeholder="Describe your item in detail..."
              maxLength={LIMITS.description}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Provide details about condition, usage, and any notable features.
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

          {/* Categories */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Categories <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map((cat, index) => {
                // Ensure cat is always a string (handle edge cases where it might be an object)
                const catString = typeof cat === 'object' && cat !== null 
                  ? (cat.value || cat.label || String(cat))
                  : String(cat);
                return (
                  <span
                    key={catString || index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
                  >
                    {catString}
                    <button
                      type="button"
                      onClick={() => removeCategory(cat)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                      aria-label={`Remove ${catString}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCategory(val);
                if (val && !categories.includes(val)) {
                  addCategory(val);
                  setSelectedCategory("");
                }
              }}
              className={`w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.categories
                  ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                  : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
              }`}
            >
              <option value="">Select a category</option>
              {availableCategories
                .filter((opt) => !categories.includes(opt))
                .map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
            </select>
            {errors.categories && (
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                {errors.categories}
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
                type="text"
                value={price}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange("price", value, setPrice);
                }}
                className={`w-full pl-8 pr-4 py-4 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.price
                    ? "border-red-500 bg-red-50/70 dark:bg-red-950/20"
                    : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                }`}
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
      </div>
    </div>
  );
}



