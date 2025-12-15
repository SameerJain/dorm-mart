import { getPublicBase } from "./api";

export const FALLBACK_IMAGE_URL = `${getPublicBase()}/data/test-images/No_image_available.svg.png`;

export function withFallbackImage(url) {
  if (typeof url === "string" && url.trim() !== "") {
    return url;
  }
  return FALLBACK_IMAGE_URL;
}
