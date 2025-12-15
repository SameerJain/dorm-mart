import { LIMITS } from "../utils/validation";

/**
 * Image uploader component for product listing form
 */
export default function ImageUploader({
  images,
  errors,
  fileInputRef,
  onFileChange,
  removeImage,
}) {
  return (
    <div
      className={`bg-white dark:bg-gray-950/30 rounded-2xl shadow-sm border p-6 mt-6 ${
        errors.images
          ? "border-red-500 dark:border-red-600"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
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
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-gray-400 dark:text-gray-500">
            No images yet
          </div>
        )}
      </div>

      {images.length < LIMITS.images && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={onFileChange}
            className="hidden"
            aria-label="Upload image"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            + Add Photo ({images.length}/{LIMITS.images})
          </button>
        </div>
      )}

      {errors.images && (
        <p className="text-red-600 dark:text-red-400 text-sm mt-2">
          {errors.images}
        </p>
      )}
    </div>
  );
}



