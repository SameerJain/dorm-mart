import { LIMITS } from "../utils/validation";

/**
 * Image cropper component for product listing form
 */
export default function ImageCropper({
  showCropper,
  cropImageSrc,
  previewBoxSize,
  cropContainerRef,
  cropCanvasRef,
  selection,
  onCropMouseMove,
  onCropMouseUp,
  startDrag,
  handleCropConfirm,
  handleCropCancel,
  handlePreviewImgLoaded,
}) {
  if (!showCropper) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-950 rounded-2xl shadow-2xl max-w-3xl w-full p-3 md:p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2">
          Crop Image
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Drag the square to choose the area you want. The square size is fixed.
        </p>

        <div className="flex justify-center">
          <div
            ref={cropContainerRef}
            onMouseMove={onCropMouseMove}
            onMouseUp={onCropMouseUp}
            onMouseLeave={onCropMouseUp}
            onTouchMove={onCropMouseMove}
            onTouchEnd={onCropMouseUp}
            className="relative bg-gray-100 dark:bg-gray-900 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 select-none"
            style={{
              width: `${previewBoxSize}px`,
              height: `${previewBoxSize}px`,
              touchAction: 'none',
            }}
          >
            {cropImageSrc ? (
              <>
                <img
                  src={cropImageSrc}
                  alt="to crop"
                  onLoad={handlePreviewImgLoaded}
                  draggable={false}
                  className="w-full h-full object-contain pointer-events-none"
                />

                {/* fixed-size draggable selection */}
                <div
                  onMouseDown={startDrag}
                  onTouchStart={startDrag}
                  style={{
                    position: "absolute",
                    left: `${selection.x}px`,
                    top: `${selection.y}px`,
                    width: `${selection.size}px`,
                    height: `${selection.size}px`,
                    border: "2px dashed #3b82f6",
                    borderRadius: "8px",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)",
                    cursor: "move",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Loading...
              </div>
            )}
          </div>
        </div>

        {/* hidden canvas */}
        <canvas
          ref={cropCanvasRef}
          width={360}
          height={360}
          className="hidden"
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCropCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCropConfirm}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            Crop &amp; Use
          </button>
        </div>
      </div>
    </div>
  );
}



