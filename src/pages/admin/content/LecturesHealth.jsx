import React, { useEffect, useState, useMemo } from "react";
import useTitle from "../../../hooks/useTitle";
import AdminBreadcrumb from "../../../components/admin/AdminBreadcrumb";
import { treeAPI, videosAPI } from "../../../utils/api";
import { Link, useNavigate } from "react-router-dom";
import {
  FiRefreshCw,
  FiDownload,
  FiFilter,
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
  FiVideo,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiPlus,
  FiSearch,
  FiBarChart2,
  FiArrowUp
} from "react-icons/fi";

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const LecturesHealth = () => {
  useTitle("كورساتي — صحة المحاضرات (إدارة)");
  const navigate = useNavigate();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState({});
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("pct");
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await treeAPI.getContentTree();
        if (cancelled) return;
        setTree(res.data || []);
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => (cancelled = true);
  }, []);

  // Handle scroll to top visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // flatten lectures into list with context
  const lectures = useMemo(() => {
    const out = [];
    for (const m of tree || []) {
      for (const instr of m.instructors || []) {
        for (const ch of instr.chapters || []) {
          for (const lec of ch.lectures || []) {
            out.push({
              lecture: lec,
              chapter: ch,
              instructor: instr,
              material: m,
            });
          }
        }
      }
    }
    return out;
  }, [tree]);

  // fetch availability for a lecture id
  const [videoStatusMap, setVideoStatusMap] = useState({}); // Map videoId -> available status
  
  const fetchForLecture = async (id) => {
    setLoadingMap((s) => ({ ...s, [id]: true }));
    try {
      const res = await videosAPI.getLectureAvailability(id);
      const d = res?.data || null;
      setStats((s) => ({ ...s, [id]: d }));
      // Store per-video availability status
      if (d && Array.isArray(d.perVideo)) {
        const statusMap = {};
        d.perVideo.forEach((v) => {
          statusMap[v.videoId] = v.available;
        });
        setVideoStatusMap((prev) => ({ ...prev, ...statusMap }));
      }
    } catch (e) {
      setStats((s) => ({ ...s, [id]: null }));
    } finally {
      setLoadingMap((s) => ({ ...s, [id]: false }));
    }
  };

  // bulk fetch with limited concurrency
  const refreshAll = async () => {
    const ids = lectures.map((l) => l.lecture._id);
    const batches = chunk(ids, 8);
    for (const b of batches) {
      await Promise.all(b.map((id) => fetchForLecture(id)));
    }
  };

  useEffect(() => {
    if (!lectures || lectures.length === 0) return;
    refreshAll();
  }, [lectures]);

  const enriched = useMemo(() => {
    return lectures.map((item) => {
      const id = item.lecture._id;
      const s = stats[id] || { total: 0, broken: 0 };
      const pct = s.total > 0 ? Math.round((s.broken / s.total) * 100) : 0;
      const status = !s.total ? "no-video" : pct === 0 ? "healthy" : pct === 100 ? "all-broken" : "partial";
      return { ...item, total: s.total || 0, broken: s.broken || 0, pct, status };
    });
  }, [lectures, stats]);

  const filtered = useMemo(() => {
    let result = enriched;
    
    // Apply filter
    if (filter === "broken") result = result.filter((e) => e.broken > 0);
    if (filter === "all-broken") result = result.filter((e) => e.total > 0 && e.broken === e.total);
    if (filter === "healthy") result = result.filter((e) => e.total > 0 && e.broken === 0);
    if (filter === "no-video") result = result.filter((e) => e.total === 0);
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.lecture.title?.toLowerCase().includes(query) ||
        e.chapter.title?.toLowerCase().includes(query) ||
        e.instructor.title?.toLowerCase().includes(query) ||
        e.material.title?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [enriched, filter, searchQuery]);

  // Local cache for stats
  const CACHE_KEY = "lecturesHealth.stats_v1";
  const CACHE_TTL_MS = 1000 * 60 * 60;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.ts && Date.now() - obj.ts < CACHE_TTL_MS && obj.stats) {
          setStats(obj.stats);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), stats }));
    } catch (e) {
      // ignore
    }
  }, [stats]);

  const exportCsv = () => {
    const header = ["material","instructor","chapter","lecture","total","broken","pct"];
    const rows = sorted.map((r) => [
      r.material.title,
      r.instructor.title,
      r.chapter.title,
      r.lecture.title,
      r.total,
      r.broken,
      r.pct,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lectures-health-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const sortedBy = (items) => {
    return items.slice().sort((a, b) => {
      if (sortBy === "pct") return b.pct - a.pct || b.total - a.total;
      if (sortBy === "broken") return b.broken - a.broken || b.pct - a.pct;
      if (sortBy === "total") return b.total - a.total || b.pct - a.pct;
      if (sortBy === "title") return a.lecture.title.localeCompare(b.lecture.title);
      return 0;
    });
  };

  const sorted = useMemo(() => sortedBy(filtered), [filtered, sortBy]);

  // Expanded lecture state
  const [expandedLectureId, setExpandedLectureId] = useState(null);
  const [lectureVideosMap, setLectureVideosMap] = useState({});
  const [videosLoadingMapLocal, setVideosLoadingMapLocal] = useState({});
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editingForm, setEditingForm] = useState({ title: "", duration: "", qualities: [] });

  const toggleLectureExpand = async (lecture) => {
    const id = lecture._id;
    if (expandedLectureId === id) {
      setExpandedLectureId(null);
      return;
    }
    setExpandedLectureId(id);
    if (!lectureVideosMap[id]) {
      setVideosLoadingMapLocal((s) => ({ ...s, [id]: true }));
      try {
        const res = await videosAPI.getVideosByLecture(id);
        setLectureVideosMap((s) => ({ ...s, [id]: res.data || [] }));
      } catch (e) {
        setLectureVideosMap((s) => ({ ...s, [id]: [] }));
      } finally {
        setVideosLoadingMapLocal((s) => ({ ...s, [id]: false }));
      }
    }
  };

  const deleteVideo = async (videoId, lectureId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الفيديو؟")) return;
    try {
      await videosAPI.deleteVideo(videoId);
      const res = await videosAPI.getVideosByLecture(lectureId);
      setLectureVideosMap((s) => ({ ...s, [lectureId]: res.data || [] }));
      fetchForLecture(lectureId);
    } catch (e) {
      alert("حصل خطأ أثناء حذف الفيديو");
    }
  };

  const startEditVideo = (v) => {
    setEditingVideoId(v._id);
    setEditingForm({ 
      title: v.title || "", 
      duration: v.duration || "", 
      qualities: Array.isArray(v.qualities) ? v.qualities.map(q => ({ quality: q.quality, lastSegmentUrl: q.lastSegmentUrl })) : [] 
    });
  };

  const cancelEdit = () => {
    setEditingVideoId(null);
    setEditingForm({ title: "", duration: "", qualities: [] });
  };

  const saveVideo = async (videoId, lectureId) => {
    try {
      await videosAPI.updateVideo(videoId, { 
        title: editingForm.title, 
        duration: editingForm.duration, 
        qualities: editingForm.qualities 
      });
      const res = await videosAPI.getVideosByLecture(lectureId);
      setLectureVideosMap((s) => ({ ...s, [lectureId]: res.data || [] }));
      setEditingVideoId(null);
      fetchForLecture(lectureId);
    } catch (e) {
      alert("حصل خطأ أثناء حفظ التعديلات");
    }
  };

  const addQualityRow = () => {
    setEditingForm((f) => ({ 
      ...f, 
      qualities: [...(f.qualities||[]), { quality: "360", lastSegmentUrl: "" }] 
    }));
  };

  const removeQualityRow = (idx) => {
    setEditingForm((f) => ({ 
      ...f, 
      qualities: (f.qualities||[]).filter((_, i) => i !== idx) 
    }));
  };

  const updateQualityField = (idx, field, value) => {
    setEditingForm((f) => ({ 
      ...f, 
      qualities: (f.qualities||[]).map((q, i) => (i === idx ? { ...q, [field]: value } : q)) 
    }));
  };

  const getStatusBadge = (status, pct) => {
    const configs = {
      "healthy": { text: "سليمة", icon: FiCheckCircle, bg: "bg-gradient-to-r from-emerald-600 to-emerald-700", textColor: "text-white" },
      "partial": { text: `${pct}% معطلة`, icon: FiAlertCircle, bg: "bg-gradient-to-r from-amber-600 to-amber-700", textColor: "text-white" },
      "all-broken": { text: "كلها معطلة", icon: FiXCircle, bg: "bg-gradient-to-r from-red-600 to-red-700", textColor: "text-white" },
      "no-video": { text: "لا فيديو", icon: FiVideo, bg: "bg-gradient-to-r from-gray-600 to-gray-700", textColor: "text-white" },
    };
    return configs[status] || configs["no-video"];
  };

  // Determine if a video is working or broken
  const isVideoWorking = (video) => {
    // Use the availability status from API if available
    const apiStatus = videoStatusMap[video._id];
    if (typeof apiStatus === 'boolean') {
      return apiStatus;
    }
    // Fallback: check if video has qualities with valid lastSegmentUrl
    return video.qualities && video.qualities.length > 0 && 
           video.qualities.some(q => q && q.lastSegmentUrl);
  };

  const getVideoStatusConfig = (video) => {
    const working = isVideoWorking(video);
    return {
      working,
      icon: working ? FiCheckCircle : FiXCircle,
      status: working ? "شغال" : "معطل",
      bg: working ? "bg-gradient-to-r from-emerald-600/20 to-green-600/20 border-emerald-500/50" : "bg-gradient-to-r from-red-600/20 to-red-700/20 border-red-500/50",
      textColor: working ? "text-emerald-300" : "text-red-300",
      badgeBg: working ? "bg-emerald-600/30" : "bg-red-600/30",
    };
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (enriched.length === 0) return null;
    const totalLectures = enriched.length;
    const totalVideos = enriched.reduce((sum, l) => sum + l.total, 0);
    const brokenVideos = enriched.reduce((sum, l) => sum + l.broken, 0);
    const healthyLectures = enriched.filter(l => l.status === "healthy").length;
    const brokenLectures = enriched.filter(l => l.status === "all-broken").length;
    const partialLectures = enriched.filter(l => l.status === "partial").length;
    
    return {
      totalLectures,
      totalVideos,
      brokenVideos,
      healthyLectures,
      brokenLectures,
      partialLectures,
      brokenPercentage: totalVideos > 0 ? Math.round((brokenVideos / totalVideos) * 100) : 0,
    };
  }, [enriched]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-gray-900 p-4 md:p-6 max-w-7xl mx-auto">
      <AdminBreadcrumb
        items={[{ label: "المواد", path: "/admin/content/materials" }, { label: "صحة المحاضرات" }]}
        className="mb-6"
      />

      {/* Header Card */}
      <div className="admin-card p-6 mb-6 bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl">
                <FiBarChart2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                مراقبة صحة المحاضرات
              </h1>
            </div>
            <p className="text-gray-300/80 text-sm md:text-base">
              مراقبة وفحص حالة فيديوهات المحاضرات وإدارتها
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button 
              onClick={refreshAll} 
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 rounded-xl text-white font-medium flex items-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <FiRefreshCw className="w-4 h-4" />
              تحديث الكل
            </button>
            <button 
              onClick={exportCsv} 
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 rounded-xl text-white font-medium flex items-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <FiDownload className="w-4 h-4" />
              تصدير CSV
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="admin-card p-4 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/30 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">إجمالي المحاضرات</div>
            <div className="text-2xl font-bold text-white">{summaryStats.totalLectures}</div>
          </div>
          <div className="admin-card p-4 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/30 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">إجمالي الفيديوهات</div>
            <div className="text-2xl font-bold text-white">{summaryStats.totalVideos}</div>
          </div>
          <div className="admin-card p-4 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/30 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">فيديوهات معطلة</div>
            <div className="text-2xl font-bold text-red-300">{summaryStats.brokenVideos}</div>
            <div className="text-xs text-gray-400 mt-1">{summaryStats.brokenPercentage}% من الإجمالي</div>
          </div>
          <div className="admin-card p-4 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/30 rounded-xl">
            <div className="text-gray-400 text-sm mb-1">محاضرات سليمة</div>
            <div className="text-2xl font-bold text-emerald-300">{summaryStats.healthyLectures}</div>
            <div className="text-xs text-gray-400 mt-1">
              {Math.round((summaryStats.healthyLectures / summaryStats.totalLectures) * 100)}% من الإجمالي
            </div>
          </div>
        </div>
      )}

      {/* Filters Card */}
      <div className="admin-card p-5 mb-6 bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FiFilter className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">الفلاتر والبحث</h2>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:flex-none md:w-64">
              <FiSearch className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث في المحاضرات أو المواد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Select */}
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            >
              <option value="all">كل المحاضرات</option>
              <option value="healthy">محاضرات سليمة فقط</option>
              <option value="broken">تحتوي على فيديو معطّل</option>
              <option value="all-broken">كل الفيديوهات معطّلة</option>
              <option value="no-video">بدون فيديوهات</option>
            </select>

            {/* Sort Select */}
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
            >
              <option value="pct">النسبة المئوية (الأعلى)</option>
              <option value="broken">عدد المعطّلات (الأكثر)</option>
              <option value="total">إجمالي الفيديوهات (الأكثر)</option>
              <option value="title">اسم المحاضرة (أ-ي)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
            <div className="text-gray-400">جاري تحميل المحاضرات...</div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="admin-card p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
              <FiVideo className="w-8 h-8 text-gray-500" />
            </div>
            <div className="text-xl font-semibold text-white mb-2">لا توجد محاضرات</div>
            <div className="text-gray-400">لم يتم العثور على محاضرات تطابق معايير البحث</div>
          </div>
        ) : (
          sorted.map((it) => {
            const id = it.lecture._id;
            const videos = lectureVideosMap[id] || [];
            const localLoading = videosLoadingMapLocal[id];
            const statusConfig = getStatusBadge(it.status, it.pct);
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedLectureId === id;

            return (
              <React.Fragment key={id}>
                {/* Lecture Card */}
                <div className={`admin-card p-5 rounded-2xl transition-all duration-300 ${isExpanded ? 'border-l-4 border-cyan-500' : 'border border-gray-700/50'} bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm hover:from-gray-800/50 hover:to-gray-900/50`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="p-2 bg-gray-800/50 rounded-lg mt-1">
                          <FiVideo className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-white text-lg mb-1">{it.lecture.title}</div>
                          <div className="flex flex-wrap gap-2 text-sm text-gray-400">
                            <span className="px-2 py-1 bg-gray-800/50 rounded-lg">{it.material.title}</span>
                            <span className="px-2 py-1 bg-gray-800/50 rounded-lg">{it.instructor.title}</span>
                            <span className="px-2 py-1 bg-gray-800/50 rounded-lg">{it.chapter.title}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:items-end gap-3">
                      {/* Stats */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-gray-400">حالة الفيديوهات</div>
                          <div className="text-lg font-bold text-white">
                            <span className="text-red-300">{it.broken}</span>
                            <span className="text-gray-500 mx-1">/</span>
                            <span className="text-white">{it.total}</span>
                          </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl ${statusConfig.bg} ${statusConfig.textColor} font-semibold flex items-center gap-2`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusConfig.text}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => fetchForLecture(id)}
                          disabled={loadingMap[id]}
                          className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${loadingMap[id] ? 'bg-gray-700 text-gray-400' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        >
                          {loadingMap[id] ? (
                            <>
                              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              جاري الفحص...
                            </>
                          ) : (
                            <>
                              <FiRefreshCw className="w-3 h-3" />
                              فحص
                            </>
                          )}
                        </button>
                        
                        <button 
                          onClick={() => toggleLectureExpand(it.lecture)}
                          className="px-3 py-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-all duration-200"
                        >
                          {isExpanded ? (
                            <>
                              <FiChevronUp className="w-4 h-4" />
                              إخفاء الفيديوهات
                            </>
                          ) : (
                            <>
                              <FiChevronDown className="w-4 h-4" />
                              عرض الفيديوهات
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Videos Section */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-gray-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-800/50 rounded-lg">
                            <FiVideo className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <div className="font-semibold text-white">قائمة فيديوهات المحاضرة</div>
                            <div className="text-sm text-gray-400">{it.lecture.title}</div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          {localLoading ? 'جاري التحميل...' : `${videos.length} فيديو`}
                        </div>
                      </div>

                      {localLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                        </div>
                      ) : videos.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          لا توجد فيديوهات لهذه المحاضرة
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {videos.map((v) => {
                            const videoStatusConfig = getVideoStatusConfig(v);
                            const VideoStatusIcon = videoStatusConfig.icon;
                            return (
                            <div key={v._id} className={`p-4 rounded-xl border-2 transition-all ${videoStatusConfig.bg}`}>
                              {editingVideoId === v._id ? (
                                // Edit Mode
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm text-gray-400 mb-2">عنوان الفيديو</label>
                                      <input
                                        value={editingForm.title}
                                        onChange={(e) => setEditingForm(f => ({...f, title: e.target.value}))}
                                        className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50"
                                        placeholder="أدخل عنوان الفيديو"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm text-gray-400 mb-2">المدة</label>
                                      <input
                                        value={editingForm.duration}
                                        onChange={(e) => setEditingForm(f => ({...f, duration: e.target.value}))}
                                        className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50"
                                        placeholder="مثال: 01:30:00"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Qualities Section */}
                                  <div>
                                    <div className="flex items-center justify-between mb-3">
                                      <label className="block text-sm text-gray-400">قائمة الجودات</label>
                                      <button
                                        onClick={addQualityRow}
                                        className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm text-white flex items-center gap-2"
                                      >
                                        <FiPlus className="w-3 h-3" />
                                        إضافة جودة
                                      </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      {(editingForm.qualities || []).map((q, qi) => (
                                        <div key={qi} className="flex flex-col md:flex-row gap-3">
                                          <input
                                            value={q.quality}
                                            onChange={(e) => updateQualityField(qi, 'quality', e.target.value)}
                                            className="px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white flex-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50"
                                            placeholder="الجودة (مثال: 360)"
                                          />
                                          <input
                                            value={q.lastSegmentUrl}
                                            onChange={(e) => updateQualityField(qi, 'lastSegmentUrl', e.target.value)}
                                            className="px-4 py-2.5 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white flex-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50"
                                            placeholder="رابط آخر مقطع (lastSegmentUrl)"
                                          />
                                          <button
                                            onClick={() => removeQualityRow(qi)}
                                            className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-red-300 hover:text-white transition-colors"
                                          >
                                            <FiTrash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
                                    <button
                                      onClick={() => saveVideo(v._id, id)}
                                      className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-lg text-white font-medium flex items-center gap-2"
                                    >
                                      <FiSave className="w-4 h-4" />
                                      حفظ التعديلات
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="px-4 py-2.5 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white"
                                    >
                                      إلغاء
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // View Mode
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className={`p-1.5 rounded-lg ${videoStatusConfig.badgeBg}`}>
                                        <VideoStatusIcon className={`w-4 h-4 ${videoStatusConfig.textColor}`} />
                                      </div>
                                      <div className="font-semibold text-white">{v.title || 'بدون عنوان'}</div>
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${videoStatusConfig.badgeBg} ${videoStatusConfig.textColor}`}>
                                        {videoStatusConfig.status}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-sm text-gray-400 mr-6">
                                      <span className="flex items-center gap-2">
                                        <FiVideo className="w-3 h-3" />
                                        {v.duration || '—'}
                                      </span>
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                                        {(v.qualities || []).length} جودة
                                      </span>
                                      <span className="text-xs px-2 py-1 bg-gray-800/50 rounded">
                                        ID: {v._id.slice(-6)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => startEditVideo(v)}
                                      className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white flex items-center gap-2 transition-colors"
                                    >
                                      <FiEdit2 className="w-3 h-3" />
                                      تعديل
                                    </button>
                                    <button
                                      onClick={() => deleteVideo(v._id, id)}
                                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-red-300 hover:text-white flex items-center gap-2 transition-colors"
                                    >
                                      <FiTrash2 className="w-3 h-3" />
                                      حذف
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 z-50"
          title="اسكرول للأعلى"
        >
          <FiArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default LecturesHealth;