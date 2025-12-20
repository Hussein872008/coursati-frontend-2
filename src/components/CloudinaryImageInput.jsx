import React, { useState, useRef } from "react";

const CloudinaryImageInput = ({
  value,
  onChange,
  label = "Upload Image",
  placeholder = "Click to upload image",
  accept = "image/*",
  required = false,
}) => {
  const [preview, setPreview] = useState(value || null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    onChange(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-lg border border-gray-200"
          />

          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
          >
            ×
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="w-full px-4 py-2 border-2 border-dashed border-blue-400 rounded-lg hover:border-blue-600 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors text-blue-600 font-medium disabled:text-gray-400"
      >
        {loading ? "جاري الرفع..." : preview ? "تغيير الصورة" : "رفع الصورة"}
      </button>
    </div>
  );
};

export default CloudinaryImageInput;
