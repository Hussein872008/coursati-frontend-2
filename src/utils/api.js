import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE;

const api = axios.create({
  baseURL: API_BASE,
});

// Simple in-memory cache for GET requests to avoid unnecessary refetches under heavy load.
const _cache = new Map();
const getCached = (key, fn, ttl = 30000) => {
  try {
    const now = Date.now();
    const entry = _cache.get(key);
    if (entry && entry.expires > now) {
      return Promise.resolve(entry.value);
    }
    return fn().then((res) => {
      try {
        _cache.set(key, { value: res, expires: now + ttl });
      } catch (e) {}
      return res;
    });
  } catch (e) {
    return fn();
  }
};

// Add user code to headers if available
api.interceptors.request.use((config) => {
  const userCode = localStorage.getItem("userCode");
  if (userCode) {
    config.headers["user-code"] = userCode;
  }
  const deviceId = localStorage.getItem("deviceId");
  if (deviceId) {
    config.headers["device-id"] = deviceId;
  }
  const sessionToken = localStorage.getItem("sessionToken");
  if (sessionToken) config.headers["session-token"] = sessionToken;
  return config;
});

// Handle subscription-expired responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || "";
      if (status === 403 && message.toLowerCase().includes("subscription")) {
        // remove stored code and redirect to login with flag
        localStorage.removeItem("userCode");
        window.location.href = "/login?expired=1";
      }
    } catch (e) {
      // ignore interceptor errors
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  adminLogin: (code) => api.post("/auth/admin-login", { code }),
  userLogin: (code) => {
    const deviceId = localStorage.getItem("deviceId") || null;
    return api.post("/auth/user-login", { code, deviceId });
  },
  createUser: (name, phone, subscriptionType) =>
    api.post("/auth/create-user", { name, phone, subscriptionType }),
  getAllUsers: () => api.get("/auth/users"),
  getUserById: (id) => api.get(`/auth/users/${id}`),
  getUserHistory: (id) => api.get(`/auth/users/${id}/history`),
  updateUser: (id, name, phone, canDownloadVideos) => {
    const body = {};
    if (typeof name !== "undefined") body.name = name;
    if (typeof phone !== "undefined") body.phone = phone;
    if (typeof canDownloadVideos !== "undefined")
      body.canDownloadVideos = !!canDownloadVideos;
    return api.put(`/auth/users/${id}`, body);
  },
  updateUserSubscription: (id, type) =>
    api.put(`/auth/users/${id}/subscription`, { type }),
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  resetUserDevice: (id) => api.put(`/auth/users/${id}/reset-device`),
};

// Tree API
export const treeAPI = {
  getContentTree: () =>
    getCached("treeAPI.getContentTree", () => api.get("/api/tree"), 30000),
};

// Materials API
export const materialAPI = {
  createMaterial: (title, thumbnailUrl, order) =>
    // support File upload for thumbnail
    (thumbnailUrl && typeof File !== "undefined" && thumbnailUrl instanceof File
      ? (() => {
          const fd = new FormData();
          fd.append("thumbnail", thumbnailUrl);
          fd.append("title", title);
          fd.append("order", order ?? 0);
          return api.post("/api/materials", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        })()
      : api.post("/api/materials", { title, thumbnailUrl, order })),
  getAllMaterials: () => api.get("/api/materials"),
  getAllMaterials: () =>
    getCached(
      "materials.getAllMaterials",
      () => api.get("/api/materials"),
      30000,
    ),
  getMaterialById: (id) => api.get(`/api/materials/${id}`),
  updateMaterial: (id, title, thumbnailUrl, order) => {
    // If a File is provided, use multipart/form-data so backend multer can handle it
    if (thumbnailUrl && typeof File !== "undefined" && thumbnailUrl instanceof File) {
      const fd = new FormData();
      fd.append("thumbnail", thumbnailUrl);
      fd.append("title", title);
      fd.append("order", order ?? 0);
      return api.put(`/api/materials/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.put(`/api/materials/${id}`, { title, thumbnailUrl, order });
  },
  deleteMaterial: (id) => api.delete(`/api/materials/${id}`),
  // Try to get count of students registered to a material (backend may not implement)
  getStudentsCount: (id) => api.get(`/api/materials/${id}/students-count`),
};

// Instructors API
export const instructorAPI = {
  createInstructor: (title, materialId, thumbnailUrl, order) => {
    // If a File is provided for thumbnailUrl, send multipart/form-data
    if (
      thumbnailUrl &&
      typeof File !== "undefined" &&
      thumbnailUrl instanceof File
    ) {
      const fd = new FormData();
      fd.append("thumbnail", thumbnailUrl);
      fd.append("title", title);
      fd.append("materialId", materialId);
      fd.append("order", order ?? 0);
      return api.post("/api/instructors", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.post("/api/instructors", {
      title,
      materialId,
      thumbnailUrl,
      order,
    });
  },
  getInstructorsByMaterial: (materialId) =>
    getCached(
      `instructors.${materialId}`,
      () => api.get(`/api/instructors/material/${materialId}`),
      30000,
    ),
  getInstructorById: (id) => api.get(`/api/instructors/${id}`),
  updateInstructor: (id, title, thumbnailUrl, order) => {
    if (
      thumbnailUrl &&
      typeof File !== "undefined" &&
      thumbnailUrl instanceof File
    ) {
      const fd = new FormData();
      fd.append("thumbnail", thumbnailUrl);
      fd.append("title", title);
      fd.append("order", order ?? 0);
      return api.put(`/api/instructors/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.put(`/api/instructors/${id}`, { title, thumbnailUrl, order });
  },
  deleteInstructor: (id) => api.delete(`/api/instructors/${id}`),
};

// Chapters API
export const chapterAPI = {
  createChapter: (title, instructorId, thumbnailUrl, order) => {
    // support File upload for thumbnail
    if (
      thumbnailUrl &&
      typeof File !== "undefined" &&
      thumbnailUrl instanceof File
    ) {
      const fd = new FormData();
      fd.append("thumbnail", thumbnailUrl);
      fd.append("title", title);
      fd.append("instructorId", instructorId);
      fd.append("order", order ?? 0);
      return api.post("/api/chapters", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.post("/api/chapters", {
      title,
      instructorId,
      thumbnailUrl,
      order,
    });
  },
  getChaptersByInstructor: (instructorId) =>
    getCached(
      `chapters.${instructorId}`,
      () => api.get(`/api/chapters/instructor/${instructorId}`),
      30000,
    ),
  getChapterById: (id) => api.get(`/api/chapters/${id}`),
  updateChapter: (id, title, thumbnailUrl, order) => {
    if (
      thumbnailUrl &&
      typeof File !== "undefined" &&
      thumbnailUrl instanceof File
    ) {
      const fd = new FormData();
      fd.append("thumbnail", thumbnailUrl);
      fd.append("title", title);
      fd.append("order", order ?? 0);
      return api.put(`/api/chapters/${id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.put(`/api/chapters/${id}`, { title, thumbnailUrl, order });
  },
  deleteChapter: (id) => api.delete(`/api/chapters/${id}`),
};

// Lectures API
export const lecturesAPI = {
  createLecture: (title, chapterId, thumbnailUrl, order) => {
    // support File upload for thumbnail (multipart/form-data)
    if (
      thumbnailUrl &&
      typeof File !== "undefined" &&
      thumbnailUrl instanceof File
    ) {
      const fd = new FormData();
      fd.append("thumbnail", thumbnailUrl);
      fd.append("title", title);
      fd.append("chapterId", chapterId);
      fd.append("order", order ?? 0);
      return api.post("/api/lectures", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return api.post("/api/lectures", { title, chapterId, thumbnailUrl, order });
  },
  getLecturesByChapter: (chapterId) =>
    getCached(
      `lectures.${chapterId}`,
      () => api.get(`/api/lectures/chapter/${chapterId}`),
      30000,
    ),
  getLectureById: (id) => api.get(`/api/lectures/${id}`),
  viewLecture: (id) => api.post(`/api/lectures/${id}/view`),
  updateLecture: (id, title, thumbnailUrl, order) =>
    // support File upload for thumbnail when updating a lecture
    thumbnailUrl && typeof File !== "undefined" && thumbnailUrl instanceof File
      ? (() => {
          const fd = new FormData();
          fd.append("thumbnail", thumbnailUrl);
          fd.append("title", title);
          fd.append("order", order ?? 0);
          return api.put(`/api/lectures/${id}`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        })()
      : api.put(`/api/lectures/${id}`, { title, thumbnailUrl, order }),
  deleteLecture: (id) => api.delete(`/api/lectures/${id}`),
  // Admin-only: get list of users who viewed this lecture
  getLectureViewers: (id) => api.get(`/api/lectures/${id}/viewers`),
};

// Notifications API
export const notificationsAPI = {
  getNotifications: () =>
    getCached(
      "notifications.getNotifications",
      () => api.get("/api/notifications"),
      15000,
    ),
    markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
    markAllRead: () => api.put(`/api/notifications/read-all`),
};

// Admin API
export const adminAPI = {
  getStats: () => api.get("/api/admin/stats"),
  getActivity: (limit = 20) => api.get(`/api/admin/activity?limit=${limit}`),
  getTimeSeries: (days = 30) =>
    api.get(`/api/admin/stats/timeseries?days=${days}`),
};

// PDFs API
export const pdfsAPI = {
  createPdf: (title, lectureId, fileUrl, order) =>
    // If a File object is provided, send as multipart/form-data with field 'file'
    fileUrl && typeof File !== "undefined" && fileUrl instanceof File
      ? (() => {
          const fd = new FormData();
          fd.append("file", fileUrl);
          fd.append("title", title);
          fd.append("lectureId", lectureId);
          fd.append("order", order ?? 0);
          return api.post("/api/pdfs", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        })()
      : api.post("/api/pdfs", { title, lectureId, fileUrl, order }),
  createPDF: (title, lectureId, fileUrl, order) =>
    api.post("/api/pdfs", { title, lectureId, fileUrl, order }),
  getPdfsByLecture: (lectureId) =>
    getCached(
      `pdfs.${lectureId}`,
      () => api.get(`/api/pdfs/lecture/${lectureId}`),
      30000,
    ),
  getPDFsByLecture: (lectureId) => api.get(`/api/pdfs/lecture/${lectureId}`),
  getPdfById: (id) => api.get(`/api/pdfs/${id}`),
  getPDFById: (id) => api.get(`/api/pdfs/${id}`),
  updatePdf: (id, title, fileUrl, order) =>
    fileUrl && typeof File !== "undefined" && fileUrl instanceof File
      ? (() => {
          const fd = new FormData();
          fd.append("file", fileUrl);
          fd.append("title", title);
          fd.append("order", order ?? 0);
          return api.put(`/api/pdfs/${id}`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        })()
      : api.put(`/api/pdfs/${id}`, { title, fileUrl, order }),
  updatePDF: (id, title, fileUrl, order) =>
    api.put(`/api/pdfs/${id}`, { title, fileUrl, order }),
  deletePdf: (id) => api.delete(`/api/pdfs/${id}`),
  deletePDF: (id) => api.delete(`/api/pdfs/${id}`),
  // Duplicate addition safe
  viewPdf: (id) => api.post(`/api/pdfs/${id}/view`),
  // Admin-only: get list of users who viewed this PDF
  getPdfViewers: (id) => api.get(`/api/pdfs/${id}/viewers`),
};

// Videos API - REMOVED: All video functionality has been removed from the project
// export const videosAPI = { ... }
// Videos API
export const videosAPI = {
  createVideo: (title, duration, lectureId, qualities) =>
    // qualities should be an array of { quality, lastSegmentUrl }
    api.post(`/api/admin/lectures/${lectureId}/videos`, {
      title,
      duration,
      qualities,
    }),
  getVideosByLecture: (lectureId) =>
    getCached(
      `videos.${lectureId}`,
      () => api.get(`/api/videos/lecture/${lectureId}`),
      30000,
    ),
  // Admin: get list of users who viewed this video
  getVideoViewers: (videoId) => api.get(`/api/videos/${videoId}/viewers`),
  // Record a video view (user playback)
  viewVideo: (videoId) => api.post(`/api/videos/${videoId}/view`),
  // Delete a video (admin)
  deleteVideo: (videoId) => api.delete(`/api/videos/${videoId}`),
  signSegment: (videoId, quality, segmentNumber) =>
    api.post(`/api/videos/${videoId}/sign`, { quality, segmentNumber }),
  validateVideo: (videoId, mirror = false) =>
    api.post(`/api/admin/videos/${videoId}/validate`, { mirror }),
};

// Search API
export const searchAPI = {
  globalSearch: (q) => api.get(`/api/search?q=${encodeURIComponent(q)}`),
};

export default api;
