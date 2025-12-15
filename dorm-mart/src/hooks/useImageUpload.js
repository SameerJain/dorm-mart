import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for image upload with preview and validation
 * 
 * @param {object} options - Configuration options
 * @param {number} options.maxFiles - Maximum number of images (default: 6)
 * @param {number} options.maxBytes - Maximum file size in bytes (default: 2MB)
 * @param {Set} options.allowedMimeTypes - Allowed MIME types (default: image/jpeg, image/png, image/webp)
 * @param {Set} options.allowedExtensions - Allowed file extensions (default: .jpg, .jpeg, .png, .webp)
 * @returns {object} { images, addImages, removeImage, clearImages, errors, validateImages }
 */
export function useImageUpload(options = {}) {
  const {
    maxFiles = 6,
    maxBytes = 2 * 1024 * 1024, // 2 MB
    allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']),
    allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']),
  } = options;

  const [images, setImages] = useState([]); // Array of {file, url, uploadedUrl?}
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  const validateFile = useCallback((file) => {
    const errors = [];

    // Check file type
    if (!allowedMimeTypes.has(file.type)) {
      errors.push(`File type ${file.type} is not allowed. Allowed types: ${Array.from(allowedMimeTypes).join(', ')}`);
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = Array.from(allowedExtensions).some(ext => fileName.endsWith(ext));
    if (!hasValidExtension) {
      errors.push(`File extension not allowed. Allowed extensions: ${Array.from(allowedExtensions).join(', ')}`);
    }

    // Check file size
    if (file.size > maxBytes) {
      const maxMB = (maxBytes / (1024 * 1024)).toFixed(2);
      errors.push(`File size exceeds ${maxMB}MB limit`);
    }

    return errors;
  }, [allowedMimeTypes, allowedExtensions, maxBytes]);

  const createImagePreview = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          file,
          url: e.target.result,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const addImages = useCallback(async (files) => {
    const fileArray = Array.from(files);
    const newErrors = { ...errors };

    // Check total count
    if (images.length + fileArray.length > maxFiles) {
      newErrors.images = `Maximum ${maxFiles} images allowed`;
      setErrors(newErrors);
      return;
    }

    // Validate and create previews for each file
    const validFiles = [];
    const previewPromises = [];

    for (const file of fileArray) {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        newErrors.images = fileErrors[0];
        setErrors(newErrors);
        continue;
      }

      validFiles.push(file);
      previewPromises.push(createImagePreview(file));
    }

    if (validFiles.length === 0) {
      return;
    }

    try {
      const previews = await Promise.all(previewPromises);
      setImages(prev => [...prev, ...previews]);
      
      // Clear errors if images were successfully added
      if (newErrors.images) {
        delete newErrors.images;
        setErrors(newErrors);
      }
    } catch (error) {
      newErrors.images = 'Failed to create image preview';
      setErrors(newErrors);
    }
  }, [images.length, maxFiles, validateFile, createImagePreview, errors]);

  const removeImage = useCallback((index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (errors.images) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.images;
        return newErrors;
      });
    }
  }, [errors]);

  const clearImages = useCallback(() => {
    setImages([]);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.images;
      return newErrors;
    });
  }, []);

  const validateImages = useCallback(() => {
    if (images.length === 0) {
      return { valid: false, error: 'At least one image is required' };
    }
    if (images.length > maxFiles) {
      return { valid: false, error: `Maximum ${maxFiles} images allowed` };
    }
    return { valid: true };
  }, [images.length, maxFiles]);

  const openFileDialog = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  return {
    images,
    addImages,
    removeImage,
    clearImages,
    errors,
    validateImages,
    fileInputRef,
    openFileDialog,
  };
}



