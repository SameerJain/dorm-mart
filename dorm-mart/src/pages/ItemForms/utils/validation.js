/**
 * Validation utilities for product listing form
 */

export const LIMITS = {
  title: 50,
  description: 1000,
  price: 9999.99,
  priceMin: 0.01,
  images: 6,
};

export const CATEGORIES_MAX = 3;

/**
 * Check if price string contains meme numbers
 */
export function containsMemePrice(priceString) {
  if (!priceString) return false;
  const digitsOnly = String(priceString).replace(/[^\d]/g, '');
  if (!digitsOnly) return false;
  
  const memeNumbers = ['666', '67', '420', '69', '80085', '8008', '5318008', '1488', '42069', '6969', '42042', '66666'];
  return memeNumbers.some(meme => digitsOnly.includes(meme));
}

/**
 * Check for XSS patterns in text
 */
function hasXSSPatterns(text) {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /onclick=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<img[^>]*on/i,
    /<svg[^>]*on/i,
    /vbscript:/i
  ];
  return xssPatterns.some(pattern => pattern.test(text));
}

/**
 * Validate title field
 */
export function validateTitle(title) {
  const trimmed = title.trim();
  if (!trimmed) {
    return "Title is required.";
  }
  if (hasXSSPatterns(title)) {
    return "Invalid characters in title";
  }
  if (trimmed.length > LIMITS.title) {
    return `Title must be ${LIMITS.title} characters or less.`;
  }
  return null;
}

/**
 * Validate price field
 */
export function validatePrice(price) {
  const trimmed = String(price).trim();
  if (!trimmed) {
    return "Price is required.";
  }
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < LIMITS.priceMin) {
    return `Price must be at least $${LIMITS.priceMin.toFixed(2)}.`;
  }
  if (num > LIMITS.price) {
    return `Price must be $${LIMITS.price.toFixed(2)} or less.`;
  }
  if (containsMemePrice(trimmed)) {
    return "Price contains inappropriate numbers.";
  }
  return null;
}

/**
 * Validate description field
 */
export function validateDescription(description) {
  const trimmed = description.trim();
  if (!trimmed) {
    return "Description is required.";
  }
  if (hasXSSPatterns(description)) {
    return "Invalid characters in description";
  }
  if (trimmed.length > LIMITS.description) {
    return `Description must be ${LIMITS.description} characters or less.`;
  }
  return null;
}

/**
 * Validate categories field
 */
export function validateCategories(categories) {
  if (!categories || categories.length === 0) {
    return "At least one category is required.";
  }
  if (categories.length > CATEGORIES_MAX) {
    return `Select at most ${CATEGORIES_MAX} categories.`;
  }
  return null;
}

/**
 * Validate images field
 */
export function validateImages(images) {
  if (!images || images.length === 0) {
    return "At least one image is required.";
  }
  if (images.length > LIMITS.images) {
    return `Maximum ${LIMITS.images} images allowed.`;
  }
  return null;
}

