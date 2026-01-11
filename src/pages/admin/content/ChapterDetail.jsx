import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { chapterAPI, lecturesAPI, clearCacheKey, videosAPI, adminAPI } from "../../../utils/api";
import { toast } from 'react-toastify';
import { Eye } from "lucide-react";
import AdminBreadcrumb from "../../../components/admin/AdminBreadcrumb";
import CloudinaryImageInput from "../../../components/CloudinaryImageInput";
import useTitle from "../../../hooks/useTitle";
import { validateAllNumericIds } from "../../../utils/routeValidation";

const ChapterDetail = () => {
  const { materialId, instructorId, chapterId } = useParams();
  const navigate = useNavigate();
  useTitle("كورساتي — تفاصيل الفصل");
  const [chapter, setChapter] = useState(null);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: "", thumbnail: "" });
  const [showForm, setShowForm] = useState(false);
  const [creatingLectureAdd, setCreatingLectureAdd] = useState(false);
  const [activeTab, setActiveTab] = useState("lectures");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ title: "", thumbnail: "" });
  const [editing, setEditing] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [lectureViewersCache, setLectureViewersCache] = useState({});
  const [hoveredLecture, setHoveredLecture] = useState(null);
  const [loadingViewers, setLoadingViewers] = useState({});
  const [videoStats, setVideoStats] = useState({});
  const [loadingVideoStats, setLoadingVideoStats] = useState({});
  const hideTimeoutRef = useRef(null);

  useEffect(() => {
    if (
      !validateAllNumericIds({ materialId, instructorId, chapterId }, [
        "materialId",
        "instructorId",
        "chapterId",
      ])
    ) {
      navigate("/admin/content/materials");
      return;
    }
    loadData();
  }, [materialId, instructorId, chapterId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const chapterRes = await chapterAPI.getChapterById(chapterId);
      const ch = chapterRes.data || {};
      // Normalize thumbnail
      ch.thumbnail = ch.thumbnailUrl || ch.thumbnail;
      setChapter(ch);

      // initialize edit form
      setEditData({ title: ch.title || "", thumbnail: ch.thumbnail || "" });

      const lecturesRes = await lecturesAPI.getLecturesByChapter(chapterId);
      setLectures(lecturesRes.data || []);
    } catch (error) {
      // Error loading data (handled by UI)
      navigate("/admin/content/materials");
    } finally {
      setLoading(false);
    }
  };

  const fetchLectureViewers = async (id) => {
    if (!id) return;
    if (lectureViewersCache[id]) return;
    setLoadingViewers((s) => ({ ...s, [id]: true }));
    try {
      const res = await lecturesAPI.getLectureViewers(id);
      setLectureViewersCache((s) => ({ ...s, [id]: res.data || [] }));
    } catch (err) {
      // Failed to load lecture viewers (handled by UI)
    } finally {
      setLoadingViewers((s) => ({ ...s, [id]: false }));
    }
  };

  // Show popover and cancel any pending hide
  const showPopover = (id) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHoveredLecture(id);
    fetchLectureViewers(id);
  };

  // Hide with a short delay to allow moving into the popover
  const hidePopoverWithDelay = (delay = 180) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredLecture(null);
      hideTimeoutRef.current = null;
    }, delay);
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, []);

  // Load per-lecture video availability stats (try aggregated admin API first)
  useEffect(() => {
    if (!lectures || lectures.length === 0) return;
    let cancelled = false;

    (async () => {
      // Try aggregated endpoint to get per-lecture videos in one call
      try {
        const res = await adminAPI.getVideoStatusSummary();
        const perLecture = res?.data?.perLecture || [];
        const map = {};
        perLecture.forEach((pl) => {
          const lid = String(pl.lectureId);
          map[lid] = {
            total: pl.total || 0,
            broken: pl.broken || 0,
            videos: Array.isArray(pl.videos)
              ? pl.videos.map((v) => ({ videoId: v._id, title: v.title, status: v.status, duration: v.duration }))
              : undefined,
            lastUpdated: pl.lastUpdated,
          };
        });

        if (!cancelled) {
          setVideoStats((s) => {
            const out = { ...(s || {}) };
            lectures.forEach((l) => {
              const key = String(l._id);
              if (map[key]) out[key] = map[key];
            });
            return out;
          });
        }
        return;
      } catch (err) {
        // aggregated API failed — fall back to per-lecture requests
      }

      // Fallback: fetch per-lecture videos individually
      const ids = lectures.map((l) => l._id);
      const promises = ids.map(async (id) => {
        try {
          setLoadingVideoStats((s) => ({ ...s, [id]: true }));
          try {
            const res = await videosAPI.getVideosByLecture(id);
            if (cancelled) return;
            const vids = (res && res.data) || [];
            const perVideo = (vids || []).map((v) => {
              const available = !!(v && Array.isArray(v.qualities) && v.qualities.length > 0 && v.qualities.some((q) => q && q.lastSegmentUrl));
              return { videoId: v._id, title: v.title, available };
            });
            const brokenCount = perVideo.filter((p) => !p.available).length;
            setVideoStats((s) => ({ ...s, [id]: { total: vids.length, broken: brokenCount, perVideo } }));
          } catch (err) {
            if (!cancelled) setVideoStats((s) => ({ ...s, [id]: null }));
          }
        } catch (err) {
          if (!cancelled) setVideoStats((s) => ({ ...s, [id]: null }));
        } finally {
          if (!cancelled) setLoadingVideoStats((s) => ({ ...s, [id]: false }));
        }
      });

      try {
        await Promise.all(promises);
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lectures]);

  const handleRecheckLecture = async (lecture) => {
    const lid = lecture._id;
    const stats = videoStats[lid];
    if (!stats || !Array.isArray(stats.videos) || stats.videos.length === 0) {
      toast.info('مافيش بيانات فيديوهات للمحاضرة دي لإعادة الفحص');
      return;
    }
    setLoadingVideoStats((s) => ({ ...s, [lid]: true }));
    try {
      const calls = stats.videos.map((v) => {
        const vid = v.videoId || v._id || v.id;
        if (!vid) return Promise.resolve({ status: 'skipped' });
        return adminAPI.recheckVideo(vid).catch((e) => ({ error: e }));
      });
      await Promise.allSettled(calls);
      toast.success(`بدأنا إعادة الفحص لمحاضرة "${lecture.title || lid}"`);
      // refresh aggregated stats
      try {
        const res = await adminAPI.getVideoStatusSummary();
        const perLecture = res?.data?.perLecture || [];
        const map = {};
        perLecture.forEach((pl) => {
          const key = String(pl.lectureId);
          map[key] = { total: pl.total || 0, broken: pl.broken || 0, videos: pl.videos };
        });
        setVideoStats((s) => ({ ...(s || {}), [lid]: map[String(lid)] || s[lid] }));
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('bulk recheck failed', e);
      toast.error('فشل بدء إعادة الفحص');
    } finally {
      setLoadingVideoStats((s) => ({ ...s, [lid]: false }));
    }
  };

  const handleDeleteChapter = async () => {
    if (
      !window.confirm(
        `هل أنت متأكد من حذف الفصل "${chapter.title}" وجميع محاضراته؟`,
      )
    )
      return;
    try {
      await chapterAPI.deleteChapter(chapterId);
      navigate(
        `/admin/content/materials/${materialId}/instructors/${instructorId}`,
      );
    } catch (error) {
      // Error deleting chapter (handled by UI)
      alert("حدث خطأ أثناء حذف الفصل");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreatingLectureAdd(true);
    try {
      await lecturesAPI.createLecture(
        formData.title,
        chapterId,
        formData.thumbnail || null,
      );
      // clear cached lectures list so loadData() fetches fresh data immediately
      try { clearCacheKey(`lectures.${chapterId}`); } catch (e) {}
      setFormData({ title: "", thumbnail: "" });
      setShowForm(false);
      await loadData();
    } catch (error) {
      // Error creating lecture (handled by UI)
    } finally {
      setCreatingLectureAdd(false);
    }
  };

  if (loading && !chapter) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-white/10 rounded w-1/4"></div>
          <div className="p-8 rounded-2xl bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10">
                        <div className="mt-3 flex items-center gap-3">
              <div className="h-32 w-32 bg-white/10 rounded-xl"></div>
              <div className="space-y-3 flex-1">
                <div className="h-8 bg-white/10 rounded w-1/3"></div>
                <div className="h-4 bg-white/10 rounded w-1/4"></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 h-32"
              >
                <div className="flex gap-6">
                  <div className="w-20 h-20 bg-white/10 rounded-xl flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="h-6 bg-white/10 rounded mb-2 w-3/4"></div>
                    <div className="h-4 bg-white/10 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-red-500/20 to-pink-500/20 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            الفصل غير موجود
          </h2>
          <p className="text-white/60 mb-6">
            الفصل الذي تبحث عنه غير موجود أو تم حذفه
          </p>
          <button
            onClick={() =>
              navigate(
                `/admin/content/materials/${materialId}/instructors/${instructorId}`,
              )
            }
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            العودة إلى الفصول
          </button>
        </div>
      </div>
    );
  }

  const breadcrumbs = [
    { label: "المواد", path: "/admin/content/materials" },
    { label: "المدرّسين", path: `/admin/content/materials/${materialId}` },
    {
      label: "الفصول",
      path: `/admin/content/materials/${materialId}/instructors/${instructorId}`,
    },
    {
      label: chapter.title,
      path: `/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}`,
    },
  ];

  return (
    <div className="min-h-screen  p-6">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <AdminBreadcrumb items={breadcrumbs} className="mb-3 -mt-2" />

        {/* Chapter Header */}
        <div className="admin-card p-6 md:p-8 mb-8 bg-gradient-to-r from-gray-800/60 via-gray-900/60 to-gray-800/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-4">
              {(chapter.thumbnailUrl || chapter.thumbnail) && (
                <div className="w-24 sm:w-32 md:w-20 h-24 sm:h-28 md:h-20 rounded-2xl overflow-hidden border-2 border-white/10 bg-white/3 flex items-center justify-center">
                  <img
                    src={chapter.thumbnailUrl || chapter.thumbnail}
                    alt={chapter.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                  {chapter.title}
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  المعرف: {chapter._id.slice(0, 8)}...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-900/40 backdrop-blur-sm rounded-2xl p-2 md:p-3 border border-white/10 mt-1 md:mt-0">
              <div className="text-center px-3">
                <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {lectures.length}
                </div>
                <div className="text-sm text-white/70">المحاضرات</div>
              </div>
              <div className="h-8 w-px bg-white/10 hidden md:block" />
              <div className="text-center px-3">
                <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {typeof chapter.viewCount === "number" ? chapter.viewCount : 0}
                </div>
                <div className="text-sm text-white/70">المشاهدات</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="admin-card p-2 mb-8 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl">
          <div className="flex space-x-2 rtl:space-x-reverse overflow-x-auto no-scrollbar py-2">
            <button
              onClick={() => setActiveTab("lectures")}
              className={`min-w-[140px] whitespace-nowrap px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === "lectures"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l9-5-9-5-9 5 9 5z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 14l6.16-3.422A12.083 12.083 0 0118 20.5c-1.123-.44-2.27-.5-6-.5s-4.877.06-6 .5c-.38.15-.74.32-1.08.5L12 14z"
                />
              </svg>
              المحاضرات ({lectures.length})
            </button>

            <button
              onClick={() => setActiveTab("details")}
              className={`min-w-[140px] whitespace-nowrap px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === "details"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 20a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
              التفاصيل
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`min-w-[140px] whitespace-nowrap px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                activeTab === "settings"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
              </svg>
              الإعدادات
            </button>
          </div>
        </div>

        {/* Lectures Tab */}
        {activeTab === "lectures" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add Lecture Card - placed first */}
                <div
                  className={`group relative transition-all duration-500 ${
                    showForm ? "scale-[1.02]" : ""
                  }`}
                >
                  {/* Glow Effect for Add Card */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div
                    onClick={() => !showForm && setShowForm(true)}
                    className={`relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border ${
                      showForm
                        ? "border-emerald-500/50"
                        : "border-white/10 group-hover:border-emerald-500/30"
                    } rounded-2xl p-6 cursor-pointer transition-all duration-500 ${
                      !showForm &&
                      "hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1"
                    }`}
                  >
                    {!showForm ? (
                      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                        {/* Content Left */}
                        <div className="flex-1">
                          <div className="mb-4">
                            <span className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold rounded-full shadow">
                              جديد
                            </span>
                          </div>

                          <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors duration-300">
                            إضافة محاضرة جديدة
                          </h3>

                          <p className="text-white/60 text-sm mb-6">
                            أضف محاضرة جديدة لهذا الفصل
                          </p>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              <span className="text-sm font-medium">انقر للبدء</span>
                            </div>
                          </div>
                        </div>

                        {/* Icon Right */}
                        <div className="w-full sm:w-28 md:w-20 h-36 sm:h-28 md:h-20 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border-2 border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors duration-300">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                            <svg
                              className="w-8 h-8 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-white">إضافة محاضرة جديدة</h3>
                            <p className="text-white/60 text-sm mt-1">املأ التفاصيل أدناه</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowForm(false);
                              setFormData({ title: "", thumbnail: "" });
                            }}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-300"
                          >
                            <svg
                              className="w-5 h-5 text-white/80"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSubmit(e);
                          }}
                          className="space-y-4"
                        >
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-1">
                              <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                                </svg>
                                عنوان المحاضرة
                              </span>
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.title}
                              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                              className="w-full px-3 py-2 text-sm bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder-white/40"
                              placeholder="أدخل عنوان المحاضرة..."
                              autoFocus
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-1">صورة المحاضرة (اختياري)</label>
                            <CloudinaryImageInput value={formData.thumbnail} onChange={(val) => setFormData({ ...formData, thumbnail: val })} />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 justify-start w-full">
                            <button
                              type="submit"
                              disabled={creatingLectureAdd}
                              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 font-semibold"
                            >
                              {creatingLectureAdd ? "جارٍ الإضافة..." : "إضافة المحاضرة"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowForm(false);
                                setFormData({ title: "", thumbnail: "" });
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 font-semibold"
                            >
                              إلغاء
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lectures Cards - New Design (sorted newest → oldest) */}
                {[...lectures]
                  .slice()
                  .sort((a, b) => {
                    const ta = new Date(a.createdAt || a._id).getTime ? new Date(a.createdAt || a._id).getTime() : 0;
                    const tb = new Date(b.createdAt || b._id).getTime ? new Date(b.createdAt || b._id).getTime() : 0;
                    return tb - ta;
                  })
                  .map((lecture, idx) => {
                    const stats = videoStats[lecture._id];
                    const isAllBroken = stats && typeof stats.total === "number" && stats.total > 0 && stats.broken === stats.total;
                    const isAllWorking = stats && typeof stats.total === "number" && stats.total > 0 && stats.broken === 0;
                    return (
                  <Link
                    key={lecture._id}
                    to={`/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}/lectures/${lecture._id}`}
                    className="group relative"
                  >
                  {/* Glow Effect */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl blur-xl transition-opacity duration-500 ${
                      hoveredLecture === lecture._id
                        ? "opacity-100"
                        : "opacity-0"
                    }`}
                  />

                  <div
                    className={`relative backdrop-blur-sm rounded-2xl p-4 sm:p-6 transition-all duration-500 ${
                      isAllBroken
                        ? "bg-gradient-to-r from-red-800/40 to-red-900/40 border border-red-500/20"
                        : isAllWorking
                        ? "bg-gradient-to-r from-emerald-700/20 to-emerald-900/20 border border-emerald-400/20 hover:shadow-emerald-500/10"
                        : stats && typeof stats.total === 'number' && stats.total > 0
                        ? "bg-gradient-to-r from-yellow-700/20 to-amber-800/20 border border-yellow-400/20 hover:shadow-yellow-400/8"
                        : "bg-gradient-to-r from-gray-800/40 to-gray-900/40 border border-white/10 hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
                      {/* Content Left */}
                      <div className="flex-1">
                        <div className="flex items-start sm:items-center gap-3 mb-3">
                          <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-semibold rounded-full shadow">
                            محاضرة #{idx + 1}
                          </span>
                          <span className="text-xs text-white/50">
                            #{lecture._id.slice(0, 8)}
                          </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 group-hover:text-cyan-300 transition-colors duration-300 line-clamp-2">
                          {lecture.title}
                        </h3>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-white/60">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                              />
                            </svg>
                            <span>المعرف: {lecture._id}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-white/60">
                            <div
                              className="relative"
                              onMouseEnter={() => showPopover(lecture._id)}
                              onMouseLeave={() => hidePopoverWithDelay()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <div className="flex items-center gap-2 cursor-default select-none">
                                <Eye className="w-4 h-4 text-gray-300" />
                                <span className="whitespace-nowrap">
                                  {lecture.viewCount ?? 0} مشاهدات
                                </span>
                              </div>

                              {/* Popover */}
                              {hoveredLecture === lecture._id && (
                                <div
                                  className="absolute z-50 top-10 md:top-8 right-0 md:right-0 left-0 md:left-auto mx-4 md:mx-0 bg-gray-900/95 border border-white/10 rounded-lg shadow-2xl p-3 min-w-max max-w-xs text-sm text-white"
                                  onMouseEnter={() => showPopover(lecture._id)}
                                  onMouseLeave={() => hidePopoverWithDelay()}
                                >
                                  {loadingViewers[lecture._id] ? (
                                    <div className="text-sm text-white/60 px-2 py-1">
                                      جاري التحميل...
                                    </div>
                                  ) : (lectureViewersCache[lecture._id] || [])
                                      .length > 0 ? (
                                    <div className="max-h-60 overflow-y-auto">
                                      {(
                                        lectureViewersCache[lecture._id] || []
                                      ).map((v, i) => (
                                        <div
                                          key={i}
                                          className="text-sm text-white px-2 py-1 border-b border-white/10 last:border-0"
                                        >
                                          <div className="font-medium text-white">
                                            {v.name ||
                                              (v.userId &&
                                                (v.userId.name ||
                                                  v.userId.code)) ||
                                              v.code}
                                          </div>
                                          <div className="text-xs text-white/60">
                                            {new Date(
                                              v.viewedAt ||
                                                v.createdAt ||
                                                Date.now(),
                                            ).toLocaleString("ar-SA")}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-white/60 px-2 py-1">
                                      لا توجد مشاهدات
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                          <span className="text-xs px-2 py-1 bg-white/10 text-white/80 rounded-lg">
                            انقر للمزيد
                          </span>
                          <svg
                            className="w-5 h-5 text-cyan-400 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        </div>

                        {/* Video counts (total / broken) */}
                        <div className="mt-3 flex items-center gap-3">
                          {loadingVideoStats[lecture._id] ? (
                            <span className="text-xs text-white/60">جاري جلب حالة الفيديوهات...</span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                                <strong className="font-semibold">{videoStats[lecture._id]?.total ?? 0}</strong>
                                <span className="text-white/70">فيديو</span>
                              </span>

                              <span className="inline-flex items-center gap-2 bg-red-500/10 text-red-300 text-xs px-2 py-1 rounded-full">
                                <svg className="w-3 h-3 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                <strong className="font-semibold text-red-200">{videoStats[lecture._id]?.broken ?? 0}</strong>
                                <span className="text-red-200/80">معطّل</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right area: show lecture thumbnail on md+, otherwise show number badge when no thumbnail */}
                      <div className="w-full sm:w-28 md:w-20 h-40 sm:h-28 md:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-blue-900/40 border-2 border-white/10 group-hover:border-cyan-500/30 transition-colors duration-300 flex items-center justify-center">
                        {lecture.thumbnailUrl || lecture.thumbnail ? (
                          <img
                            src={lecture.thumbnailUrl || lecture.thumbnail}
                            alt={lecture.title}
                            className="block w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                            <span className="text-xl sm:text-2xl font-bold text-white">
                              #{idx + 1}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
                );
                  })}

            </div>
          </div>
        )}

        {/* Details Tab */}
        {activeTab === "details" && (
          <div className="admin-card p-8 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  معلومات الفصل
                </h3>

                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <div className="text-sm text-white/50 mb-1">اسم الفصل</div>
                    <div className="text-lg font-semibold text-white">
                      {chapter.title}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <div className="text-sm text-white/50 mb-1">معرف الفصل</div>
                    <div className="font-mono text-white/80 break-all">
                      {chapter._id}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  إحصائيات
                </h3>

                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border-l-4 border-cyan-400">
                    <div className="text-2xl font-bold text-cyan-300">
                      {lectures.length}
                    </div>
                    <div className="text-sm text-cyan-200">عدد المحاضرات</div>
                  </div>

                  <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border-l-4 border-emerald-400">
                    <div className="text-2xl font-bold text-emerald-300">
                      {typeof chapter.viewCount === "number"
                        ? chapter.viewCount
                        : 0}
                    </div>
                    <div className="text-sm text-emerald-200">المشاهدات</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="admin-card p-8 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-3xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              إعدادات الفصل
            </h3>

            <div className="space-y-6">
              {/* Edit Card */}
              <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-400/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-start gap-6">
                  <div className="w-28 h-28 rounded-xl overflow-hidden bg-white/5 border-2 border-white/10 flex items-center justify-center">
                    {editData.thumbnail ? (
                      <img
                        src={
                          typeof editData.thumbnail === "string"
                            ? editData.thumbnail
                            : ""
                        }
                        alt="thumbnail"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-white/40">
                        <svg
                          className="w-8 h-8 mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                        <span className="text-xs">صورة</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-amber-300">
                          تعديل معلومات الفصل
                        </h4>
                        <p className="text-sm text-amber-200/80">
                          قم بتعديل اسم الفصل وصورة العرض
                        </p>
                      </div>
                      <div>
                        {!editMode ? (
                          <button
                            onClick={() => setEditMode(true)}
                            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-md hover:shadow-blue-500/20 font-semibold"
                          >
                            تعديل
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditMode(false);
                              setEditData({
                                title: chapter.title || "",
                                thumbnail: chapter.thumbnail || "",
                              });
                              setEditSuccess(false);
                            }}
                            className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 font-semibold"
                          >
                            إلغاء
                          </button>
                        )}
                      </div>
                    </div>

                    {editMode && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          setEditing(true);
                          try {
                            await chapterAPI.updateChapter(
                              chapterId,
                              editData.title,
                              editData.thumbnail || null,
                              chapter.order || 0,
                            );
                            setEditSuccess(true);
                            setEditMode(false);
                            await loadData();
                          } catch (err) {
                            // Error updating chapter (handled by UI)
                            alert("حدث خطأ أثناء تحديث بيانات الفصل");
                          } finally {
                            setEditing(false);
                          }
                        }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                              اسم الفصل
                            </label>
                            <input
                              type="text"
                              value={editData.title}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  title: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                              صورة الغلاف
                            </label>
                            <CloudinaryImageInput
                              value={editData.thumbnail}
                              onChange={(val) =>
                                setEditData({ ...editData, thumbnail: val })
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="submit"
                            disabled={editing}
                            className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 font-semibold"
                          >
                            {editing ? "جاري الحفظ..." : "حفظ التغييرات"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditMode(false);
                              setEditData({
                                title: chapter.title || "",
                                thumbnail: chapter.thumbnail || "",
                              });
                            }}
                            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                          >
                            إلغاء
                          </button>
                          {editSuccess && (
                            <span className="text-sm text-emerald-300 flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              تم الحفظ بنجاح
                            </span>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-400/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-red-300 mb-2">
                      منطقة الخطر
                    </h4>
                    <p className="text-red-200/80">
                      حذف هذا الفصل سيزيل جميع المحاضرات المتعلقة به
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteChapter}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/20 transform hover:-translate-y-0.5 transition-all duration-200 font-semibold whitespace-nowrap"
                  >
                    حذف الفصل
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChapterDetail;
