/**
 * Image utility functions for product listing
 */

export const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
export const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Check if file type is allowed
 */
export function isAllowedType(file) {
  if (!file || !file.type) return false;
  const ext = file.name ? file.name.toLowerCase().substring(file.name.lastIndexOf('.')) : '';
  return ALLOWED_MIME.has(file.type) || ALLOWED_EXTS.has(ext);
}

/**
 * Validate file size
 */
export function validateFileSize(file) {
  if (!file) return false;
  return file.size <= MAX_BYTES;
}

/**
 * Process image file and return data URL
 */
export function processImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl: ev.target.result, img });
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}



