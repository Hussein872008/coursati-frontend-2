import { useState } from 'react';
import api from '../utils/api';

/**
 * useFileUpload Hook
 * Handles file upload to backend with FormData
 */
export const useFileUpload = (endpoint) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadFile = async (file, additionalData = {}) => {
    if (!file) {
      setError('الرجاء اختيار ملف');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Create FormData
      const formData = new FormData();
      
      // Add file
      const fieldName = endpoint.includes('pdf') ? 'file' : 
                       endpoint.includes('video') ? 'video' : 'thumbnail';
      formData.append(fieldName, file);

      // Add additional data
      Object.keys(additionalData).forEach(key => {
        if (additionalData[key] !== null && additionalData[key] !== undefined) {
          formData.append(key, additionalData[key]);
        }
      });

      // Upload to backend
      // Use axios instance which already adds `user-code` via interceptor
      const res = await api.post(`/api${endpoint}`, formData);
      return res.data;

    } catch (err) {
      setError(err.message);
      // Upload error (handled by caller)
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { uploadFile, loading, error };
};

/**
 * useFilesUpload Hook
 * Handles multiple file uploads
 */
export const useFilesUpload = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadFiles = async (files, endpoint, additionalData = {}) => {
    if (!files || files.length === 0) {
      setError('الرجاء اختيار ملفات');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Add all files
      files.forEach((file, index) => {
        formData.append(`files[]`, file);
      });

      // Add additional data
      Object.keys(additionalData).forEach(key => {
        if (additionalData[key] !== null && additionalData[key] !== undefined) {
          formData.append(key, additionalData[key]);
        }
      });

      // Upload to backend
      const res = await api.post(`/api${endpoint}`, formData);
      return res.data;

    } catch (err) {
      setError(err.message);
      // Upload error (handled by caller)
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { uploadFiles, loading, error };
};

export default useFileUpload;
