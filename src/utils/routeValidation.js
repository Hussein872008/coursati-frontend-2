/**
 * Utility functions for validating and parsing route parameters
 */

/**
 * Validates if a string contains only numeric characters
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if the ID is numeric, false otherwise
 */
export const isNumericId = (id) => {
  return /^\d+$/.test(id);
};

/**
 * Validates common ID formats used in the app: either numeric IDs or 24-char hex (Mongo ObjectId)
 * @param {string} id
 * @returns {boolean}
 */
export const isValidId = (id) => {
  if (!id || typeof id !== 'string') return false;
  const isNumeric = /^\d+$/.test(id);
  const isMongoHex = /^[a-fA-F0-9]{24}$/.test(id);
  return isNumeric || isMongoHex;
};

/**
 * Converts a route parameter to a number and validates it
 * @param {string} id - The ID to convert
 * @returns {number|null} - The numeric ID or null if invalid
 */
export const parseNumericId = (id) => {
  if (!isNumericId(id)) {
    return null;
  }
  return parseInt(id, 10);
};

/**
 * Validates multiple route parameters at once
 * @param {Object} params - Object containing route parameters
 * @param {Array<string>} paramNames - Array of parameter names to validate
 * @returns {boolean} - True if all parameters are numeric, false otherwise
 */
export const validateAllNumericIds = (params, paramNames) => {
  // Accept either numeric IDs or Mongo ObjectId hex strings
  return paramNames.every((name) => isValidId(params[name]));
};

/**
 * Creates a navigation path with numeric IDs
 * @param {string} basePath - The base path (e.g., '/admin/content/materials')
 * @param {...number} ids - Variable number of numeric IDs to append
 * @returns {string} - The complete path
 */
export const createAdminPath = (basePath, ...ids) => {
  const validIds = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (validIds.length !== ids.length) {
    throw new Error('All IDs must be positive integers');
  }
  return `${basePath}/${validIds.join('/')}`;
};

/**
 * Extracts all numeric IDs from route params
 * @param {Object} params - Route parameters object
 * @returns {Array<number>} - Array of numeric IDs in order
 */
export const extractNumericIds = (params) => {
  const ids = [];
  const keys = Object.keys(params).sort();
  
  for (const key of keys) {
    if (key.includes('Id')) {
      const id = parseNumericId(params[key]);
      if (id !== null) {
        ids.push(id);
      }
    }
  }
  
  return ids;
};

/**
 * Validates that a numeric ID is within expected range
 * @param {number} id - The ID to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {boolean} - True if ID is within range, false otherwise
 */
export const isIdInRange = (id, min = 1, max = 9999999) => {
  return Number.isInteger(id) && id >= min && id <= max;
};

/**
 * Generates a breadcrumb navigation path from route params
 * @param {Object} params - Route parameters object
 * @param {Array<string>} labels - Labels for each ID (in order)
 * @returns {Array<Object>} - Array of breadcrumb objects {label, id}
 */
export const generateBreadcrumbs = (params, labels) => {
  const ids = extractNumericIds(params);
  return ids.map((id, index) => ({
    label: labels[index] || `Item ${index + 1}`,
    id,
  }));
};
