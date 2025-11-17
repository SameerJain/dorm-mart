const PUBLIC_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
export const FALLBACK_IMAGE_URL = `${PUBLIC_BASE}/data/test-images/No_image_available.svg.png`;

export function withFallbackImage(url) {
  if (typeof url === "string" && url.trim() !== "") {
    return url;
  }
  return FALLBACK_IMAGE_URL;
}
