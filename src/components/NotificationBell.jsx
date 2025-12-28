import React, { useEffect, useState, useRef } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { notificationsAPI } from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const DEFAULT_ICON = (
  <div className="w-12 h-8 bg-gray-700/70 rounded-md flex items-center justify-center text-white">
    م
  </div>
);

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const latestRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetch = async () => {
    try {
      const res = await notificationsAPI.getNotifications();
      const data = res.data || [];
      setNotifications(data);

      const newest = data.find((n) => !n.isRead);
      if (newest && (!latestRef.current || newest._id !== latestRef.current)) {
        setToast(newest);
        latestRef.current = newest._id;
        setTimeout(() => setToast(null), 6000);
        try {
          showBrowserNotification(newest);
        } catch (e) {}
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, []);

  // Close on Escape key when modal is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleOpen = () => setOpen((s) => !s);

  const goToLecture = (n) => {
    try {
      setOpen(false);
      // If this notification is admin-only and the current user is an admin,
      // navigate to the admin lecture redirect which will open the admin lecture
      // detail and support the `highlight` query param to highlight a video card.
      if (n && n.adminOnly && user && user.isAdmin && n.lectureId) {
        setOpen(false);
        const url = `/admin/content/lecture/${n.lectureId}${n.videoId ? '?highlight='+encodeURIComponent(n.videoId) : ''}`;
        navigate(url);
        return;
      }

      if (n && n.chapterId) {
        const qp = new URLSearchParams();
        if (n.lectureId) qp.set("lecture", n.lectureId);
        if (n.videoId) qp.set("video", n.videoId);
        const qs = qp.toString();
        const hash = n.lectureId ? `#lecture-${n.lectureId}` : "";
          const url = `/chapter/${n.chapterId}${qs ? `?${qs}` : ""}${hash}`;
        navigate(url);
      }
    } catch (e) {}
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((p) => (p._id === id ? { ...p, isRead: true } : p)),
      );
    } catch (e) {}
  };

  const showBrowserNotification = async (n) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      if (Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch (e) {}
      }
      if (Notification.permission !== "granted") return;
      const subtitleParts = [n.chapterTitle, n.instructorTitle, n.materialTitle]
        .filter(Boolean)
        .join(" - ");
      const body = subtitleParts || "";
      const icon = n.thumbnailUrl || undefined;
      const tag = `notif-${n._id}`;
      const notif = new Notification(n.title, {
        body,
        icon,
        tag,
        data: {
          chapterId: n.chapterId,
          lectureId: n.lectureId,
          videoId: n.videoId,
        },
      });
      notif.onclick = (ev) => {
        try {
          ev.preventDefault();
        } catch (e) {}
        try {
          window.focus();
        } catch (e) {}
        try {
          // mark notification as read in backend and update UI
          try {
            handleMarkRead(n._id);
          } catch (e) {}
          // prefer admin redirect for admin-only notifications
          if (n.adminOnly && user && user.isAdmin && n.lectureId) {
            const url = `/admin/content/lecture/${n.lectureId}${n.videoId ? '?highlight='+encodeURIComponent(n.videoId) : ''}`;
            navigate(url);
          } else {
            const qp = new URLSearchParams();
            if (n.lectureId) qp.set("lecture", n.lectureId);
            if (n.videoId) qp.set("video", n.videoId);
            const qs = qp.toString();
            const hash = n.lectureId ? `#lecture-${n.lectureId}` : "";
            const url = `/chapter/${n.chapterId}${qs ? `?${qs}` : ""}${hash}`;
            navigate(url);
          }
        } catch (e) {}
        try {
          notif.close();
        } catch (e) {}
      };
    } catch (e) {}
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 transition text-white relative"
        aria-label="الإشعارات"
      >
        <BellIcon className="w-7 h-7 sm:w-8 sm:h-8" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-start pt-16 animate-fadeIn"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              aria-label="إغلاق الإشعارات"
              className="absolute top-3 left-3 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="font-semibold text-white mb-4 text-lg text-center">
              الإشعارات
            </div>
            <div className="flex justify-end mb-3 gap-2">
              <button
                onClick={async () => {
                  try {
                    await notificationsAPI.markAllRead();
                    setNotifications((prev) => prev.map((p) => ({ ...p, isRead: true })));
                  } catch (e) {}
                }}
                className="text-sm px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white"
              >
                تعليم الكل كمقروء
              </button>
            </div>
            {notifications.length === 0 && (
              <div className="text-sm text-white/60 text-center">
                لا توجد إشعارات
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n._id}
                onClick={async () => {
                  await handleMarkRead(n._id);
                  goToLecture(n);
                }}
                className={`flex gap-3 p-3 rounded-md cursor-pointer transition-all duration-200
                  ${n.isRead ? "bg-gray-700/50 hover:bg-gray-700/60" : "bg-gradient-to-r from-blue-600/70 to-blue-500/70 hover:from-blue-500/80 hover:to-blue-400/80"}`}
              >
                <div className="w-14 h-14 bg-gray-700 rounded-md overflow-hidden flex-shrink-0">
                  {n.thumbnailUrl ? (
                    <img
                      src={n.thumbnailUrl}
                      alt="thumb"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    DEFAULT_ICON
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-white font-medium">{n.title}</div>
                    {n.adminOnly && (
                      <div className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">ادمن</div>
                    )}
                  </div>
                  <div className="text-xs text-white/60">
                    {n.chapterTitle || n.instructorTitle || n.materialTitle
                      ? `${n.chapterTitle || ""}${n.chapterTitle && n.instructorTitle ? " - " : ""}${n.instructorTitle || ""}${(n.instructorTitle || n.chapterTitle) && n.materialTitle ? " - " : ""}${n.materialTitle || ""}`
                      : null}
                  </div>
                  <div className="text-xs text-white/60">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <style>
            {`
              .overflow-auto::-webkit-scrollbar {
                width: 8px;
              }
              .overflow-auto::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.05);
                border-radius: 4px;
              }
              .overflow-auto::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 4px;
              }
              .overflow-auto::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.4);
              }
              @keyframes fadeIn {
                0% { opacity: 0; transform: translateY(-10px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              .animate-fadeIn {
                animation: fadeIn 0.3s ease-out;
              }
            `}
          </style>
        </div>
      )}

      {toast && (
        <div className="fixed left-4 bottom-6 z-50 bg-gray-900/95 text-white rounded-lg p-3 shadow-lg flex gap-3 items-start">
          <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-700">
            {toast.thumbnailUrl ? (
              <img
                src={toast.thumbnailUrl}
                className="w-full h-full object-cover"
              />
            ) : (
              DEFAULT_ICON
            )}
          </div>
          <div style={{ minWidth: 160 }}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{toast.title}</div>
              {toast.adminOnly && <div className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">ادمن</div>}
            </div>
            <div className="text-sm text-white/60">{new Date(toast.createdAt).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
