import React, { useState, useRef } from "react";

/**
 * FileUploadWidget Component
 * Provides file upload from device (image, PDF, video)
 */
const FileUploadWidget = ({
  fileType = "image", // 'image', 'pdf', 'video'
  value,
  onChange,
  label = "Upload File",
  required = false,
}) => {
  const [preview, setPreview] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const getAcceptTypes = () => {
    switch (fileType) {
      case "image":
        return "image/*";
      case "pdf":
        return ".pdf,application/pdf";
      case "video":
        return "video/*";
      default:
        return "*/*";
    }
  };

  const getIcon = () => {
    switch (fileType) {
      case "image":
        return "🖼️";
      case "pdf":
        return "📄";
      case "video":
        return "🎬";
      default:
        return "📁";
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = {
      image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      pdf: ["application/pdf"],
      video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
    };

    if (!validTypes[fileType]?.includes(file.type)) {
      alert(`نوع الملف غير صحيح. الرجاء اختيار ملف ${fileType}`);
      return;
    }

    if (fileType === "image") {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else if (fileType === "video") {
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }

    setFileInfo({
      name: file.name,
      size: file.size,
      type: fileType,
    });

    onChange(file);
  };

  const handleRemove = () => {
    setPreview(null);
    setFileInfo(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getLabelText = () => {
    switch (fileType) {
      case "image":
        return {
          upload: "رفع الصورة",
          change: "تغيير الصورة",
          uploading: "جاري رفع الصورة...",
        };
      case "pdf":
        return {
          upload: "رفع PDF",
          change: "تغيير PDF",
          uploading: "جاري رفع PDF...",
        };
      case "video":
        return {
          upload: "رفع الفيديو",
          change: "تغيير الفيديو",
          uploading: "جاري رفع الفيديو...",
        };
      default:
        return {
          upload: "رفع ملف",
          change: "تغيير الملف",
          uploading: "جاري الرفع...",
        };
    }
  };

  const labels = getLabelText();

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {preview && (fileType === "image" || fileType === "video") && (
        <div className="relative inline-block">
          {fileType === "image" ? (
            <img
              src={preview}
              alt="Preview"
              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
            />
          ) : (
            <video
              src={preview}
              className="w-32 h-32 object-cover rounded-lg border border-gray-200"
              controls
            />
          )}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
          >
            ×
          </button>
        </div>
      )}

      {fileInfo && (fileType === "pdf" || fileType === "video") && (
        <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getIcon()}</div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {fileInfo.name}
              </p>
              <p className="text-xs text-gray-600">
                {formatFileSize(fileInfo.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-red-500 hover:text-red-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptTypes()}
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="w-full px-4 py-2 border-2 border-dashed border-blue-400 rounded-lg hover:border-blue-600 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors text-blue-600 font-medium disabled:text-gray-400"
      >
        {loading ? labels.uploading : fileInfo ? labels.change : labels.upload}
      </button>
    </div>
  );
};

export default FileUploadWidget;
