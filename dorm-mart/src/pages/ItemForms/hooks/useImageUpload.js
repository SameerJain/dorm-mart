import { LIMITS } from "../utils/validation";
import { isAllowedType, validateFileSize } from "../utils/imageUtils";

/**
 * Hook to handle image file uploads and cropping
 */
export function useImageUpload(images, setImages, setErrors, errors, setShowCropper, setCropImageSrc, setCropImgEl, setPendingFileName) {
  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 1);
    if (!files.length) return;

    if (images.length >= LIMITS.images) {
      setErrors((prev) => ({
        ...prev,
        images: `Maximum ${LIMITS.images} images allowed.`,
      }));
      e.target.value = null;
      return;
    }

    const file = files[0];

    if (!validateFileSize(file)) {
      setErrors((prev) => ({
        ...prev,
        images: "Image is too large. Max size is 2 MB.",
      }));
      e.target.value = null;
      return;
    }

    if (!isAllowedType(file)) {
      setErrors((prev) => ({
        ...prev,
        images: "Only JPG/JPEG, PNG, and WEBP images are allowed.",
      }));
      e.target.value = null;
      return;
    }

    if (errors.images && (errors.images.includes("Image is too large") || errors.images.includes("Only JPG/JPEG"))) {
      setErrors((prev) => {
        const ne = { ...prev };
        delete ne.images;
        return ne;
      });
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        if (images.length >= LIMITS.images) {
          setErrors((prev) => ({
            ...prev,
            images: `Maximum ${LIMITS.images} images allowed.`,
          }));
          e.target.value = null;
          return;
        }

        const w = img.width;
        const h = img.height;
        if (w === h) {
          setImages((prev) => [
            ...prev,
            {
              file,
              url: ev.target.result,
            },
          ]);
          if (errors.images) {
            setErrors((prev) => {
              const ne = { ...prev };
              delete ne.images;
              return ne;
            });
          }
        } else {
          if (images.length >= LIMITS.images) {
            setErrors((prev) => ({
              ...prev,
              images: `Maximum ${LIMITS.images} images allowed.`,
            }));
            e.target.value = null;
            return;
          }
          setCropImageSrc(ev.target.result);
          setCropImgEl(img);
          setPendingFileName(file.name || "image.png");
          setShowCropper(true);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);

    e.target.value = null;
  };

  return { onFileChange };
}



