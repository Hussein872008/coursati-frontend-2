import React, { useState, useEffect, useRef } from "react";
import useTitle from "../../../hooks/useTitle";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api, { pdfsAPI, lecturesAPI, videosAPI, adminAPI } from "../../../utils/api";
import AdminBreadcrumb from "../../../components/admin/AdminBreadcrumb";
import CloudinaryImageInput from "../../../components/CloudinaryImageInput";
import VideoPlayer from "../../../components/VideoPlayer";
import { useAuth } from "../../../hooks/useAuth";
import PDFUpload from "../../../components/PDFUpload";
import { validateAllNumericIds } from "../../../utils/routeValidation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Info,
  Plus,
  X,
  Eye,
  ExternalLink,
  ChevronRight,
  BarChart3,
  Clock,
  Calendar,
  Edit3,
  Trash2,
  ChevronLeft,
  Users,
  EyeOff,
  FileDown,
  Loader,
} from "lucide-react";
import { toast } from "react-toastify";

import EditModal from "../../../components/admin/EditModal";

const LectureDetailWithMedia = () => {
  const { materialId, instructorId, chapterId, lectureId } = useParams();
  const navigate = useNavigate();

  useTitle("كورساتي — تفاصيل المحاضرة");

  // States for lecture
  const [lecture, setLecture] = useState(null);
  const [lectureLoading, setLectureLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for PDFs
  const [pdfs, setPdfs] = useState([]);
  const [pdfsLoading, setPdfsLoading] = useState(false);
  const [pdfFormData, setPdfFormData] = useState({ title: "", url: "" });
  const [showPdfForm, setShowPdfForm] = useState(false);
  const [editingPdf, setEditingPdf] = useState(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Viewer UI states

                                        <div className="ml-2">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleRecheckVideo(video); }}
                                            className="w-full sm:w-auto flex items-center gap-2 text-sm text-white px-3 py-1 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all"
                                            title="إعادة فحص الحالة"
                                          >
                                            ↻
                                            <span className="hidden sm:inline">إعادة فحص</span>
                                          </button>
                                        </div>
  const [pdfViewersMap, setPdfViewersMap] = useState({});
  const [pdfViewersLoadingId, setPdfViewersLoadingId] = useState(null);
  // `activePdfId` is the PDF whose viewers popover is open (click-to-toggle)
  const [activePdfId, setActivePdfId] = useState(null);
  // Video viewers UI
  const [videoViewersMap, setVideoViewersMap] = useState({});
  const [videoViewersLoadingId, setVideoViewersLoadingId] = useState(null);
  const [videoStatusMap, setVideoStatusMap] = useState({});
  const [videoDownloadsMap, setVideoDownloadsMap] = useState({});
  const [videoDownloadsLoadingId, setVideoDownloadsLoadingId] = useState(null);
  const [hoveredVideoId, setHoveredVideoId] = useState(null);
  const [validatingMap, setValidatingMap] = useState({});
  // Fixed-position popover for video viewers (to avoid clipping by overflow)
  const [videoPopover, setVideoPopover] = useState(null); // { videoId, left, top, width }
  // Fixed-position popover for PDF viewers
  const [pdfPopover, setPdfPopover] = useState(null); // { pdfId, left, top, width }

  const { user } = useAuth();

  // Active tab state - default to PDFs since videos are removed
  const [activeTab, setActiveTab] = useState("videos");
  // Videos state
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoFormData, setVideoFormData] = useState({
    title: "",
    duration: 0,
    hours: "",
    minutes: "",
    seconds: "",
    qualities: [{ quality: "360", lastSegmentUrl: "" }],
  });
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  // Video player modal state
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  // Lecture edit state
  const [editingLectureTitle, setEditingLectureTitle] = useState(false);
  const [lectureTitleInput, setLectureTitleInput] = useState("");
  const [lectureEditThumbnail, setLectureEditThumbnail] = useState("");

  // Animation states
  const [isDeleting, setIsDeleting] = useState(false);
  // Delete confirmation modal target: { type: 'lecture'|'pdf'|'video', id, name }
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (
      !validateAllNumericIds(
        { materialId, instructorId, chapterId, lectureId },
        ["materialId", "instructorId", "chapterId", "lectureId"],
      )
    ) {
      navigate("/admin/content/materials");
      return;
    }
    loadLecture();
    loadPdfs();
    loadVideos();
  }, [materialId, instructorId, chapterId, lectureId]);

  // handle external highlight query param: scroll to and briefly highlight a video
  const location = useLocation();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const highlight = q.get('highlight');
    if (!highlight) return;
    if (!videos || videos.length === 0) return;
    // small timeout to ensure DOM rendered
    setTimeout(() => {
      const el = document.getElementById(`video-${highlight}`);
      if (el) {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
        el.classList.add('ring-4','ring-amber-400');
        setTimeout(() => { el.classList.remove('ring-4','ring-amber-400'); }, 4500);
      }
    }, 300);
  }, [location.search, videos]);

  // Helper: responsive popover style (full-width on small screens)
  const getPopoverStyle = (p) => {
    if (!p) return { display: "none" };
    if (typeof window === "undefined") {
      return { position: "fixed", left: p.left, top: p.top, zIndex: 9999 };
    }
    const isSmall = window.innerWidth < 640; // tailwind 'sm' breakpoint
    if (isSmall) {
      return { position: "fixed", left: 16, right: 16, top: p.top + 8, zIndex: 9999 };
    }
    return { position: "fixed", left: p.left, top: p.top, zIndex: 9999, transform: "translateX(-80px)" };
  };

  // Suggest next quality when adding new quality rows
  const getNextQuality = (qualities = []) => {
    const common = [360, 480, 720, 1080, 1440];
    if (!qualities || qualities.length === 0) return String(common[0]);
    // try parse last numeric quality
    const last = qualities[qualities.length - 1];
    const lastNum = parseInt(last?.quality, 10) || NaN;
    if (!isNaN(lastNum)) {
      const idx = common.indexOf(lastNum);
      if (idx >= 0 && idx < common.length - 1) return String(common[idx + 1]);
      // if last is larger or unknown, return largest known next (e.g., 1080 -> 1440)
      for (const q of common) if (q > lastNum) return String(q);
      return String(common[common.length - 1]);
    }
    // fallback: suggest 480 if first was 360, else 720
    if (qualities.length === 1) return "480";
    return "720";
  };

  const loadVideos = async () => {
    setVideosLoading(true);
    try {
      const res = await videosAPI.getVideosByLecture(lectureId);
      const vids = res.data || [];
      setVideos(vids);
      // prefetch viewers for each video so counts show immediately
      vids.forEach((vd) => {
        try {
          fetchVideoViewers(vd._id);
        } catch (e) {}
      });
    } catch (err) {
      // Error loading videos (handled by UI)
    } finally {
      setVideosLoading(false);
    }
  };

  const loadLecture = async () => {
    setLectureLoading(true);
    setError(null);
    try {
      const res = await lecturesAPI.getLectureById(lectureId);
      setLecture(res.data);
      setLectureTitleInput(res.data?.title || "");
      setLectureEditThumbnail(
        res.data?.thumbnailUrl || res.data?.thumbnail || "",
      );
    } catch (error) {
      // Error loading lecture (handled by UI)
      setError("فشل تحميل بيانات المحاضرة");
      navigate("/admin/content/materials");
    } finally {
      setLectureLoading(false);
    }
  };

  const handleLectureSave = async () => {
    try {
      const updated = await lecturesAPI.updateLecture(
        lecture._id,
        lectureTitleInput,
        lectureEditThumbnail || lecture.thumbnailUrl || lecture.thumbnail || "",
        lecture.order ?? 0,
      );
      setLecture(
        updated.data || {
          ...lecture,
          title: lectureTitleInput,
          thumbnailUrl:
            lectureEditThumbnail ||
            lecture.thumbnailUrl ||
            lecture.thumbnail ||
            "",
        },
      );
      setEditingLectureTitle(false);
    } catch (err) {
      // Error updating lecture title (handled by UI)
      alert("فشل تحديث اسم المحاضرة");
    }
  };

  const handleLectureDelete = async () => {
    setDeleteTarget({
      type: "lecture",
      id: lecture._id,
      name: lecture.title || "المحاضرة",
    });
  };

  // Video loading removed - video functionality has been removed from the project

  const loadPdfs = async () => {
    setPdfsLoading(true);
    try {
      const response = await pdfsAPI.getPdfsByLecture(lectureId);
      setPdfs(response.data || []);
    } catch (error) {
      // Error loading PDFs (handled by UI)
    } finally {
      setPdfsLoading(false);
    }
  };

  // Video handling functions removed - video functionality has been removed from the project

  // derived video stats
  const totalVideoDuration = videos.reduce(
    (sum, v) => sum + (Number(v.duration) || 0),
    0,
  );
  const formatHMS = (s) => {
    const secTotal = Math.floor(Number(s) || 0);
    const h = Math.floor(secTotal / 3600);
    const m = Math.floor((secTotal % 3600) / 60);
    const sec = secTotal % 60;
    return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  };

  const handlePdfSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsUploadingPdf(true);
      if (editingPdf) {
        await pdfsAPI.updatePdf(
          editingPdf._id,
          pdfFormData.title,
          pdfFormData.url,
          0,
        );
        setEditingPdf(null);
      } else {
        await pdfsAPI.createPdf(
          pdfFormData.title,
          lectureId,
          pdfFormData.url,
          0,
        );
      }
      resetPdfForm();
      await loadPdfs();
    } catch (error) {
      // Error saving PDF (handled by UI)
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Video submit (admin)
  const handleVideoSubmit = async (e) => {
    e.preventDefault();
    // Validate qualities before submitting
    const validateQualities = (qualities) => {
      if (!qualities || qualities.length === 0) return { ok: true };
      // ensure quality keys are unique
      const quals = qualities.map((q) => String(q.quality || '').trim());
      const dup = quals.find((v, i) => v && quals.indexOf(v) !== i);
      if (dup) return { ok: false, message: `الجودة "${dup}" مكرّرة. الرجاء حذف التكرارات.` };

      // ensure URLs are present and not identical
      const urls = qualities.map((q) => String(q.lastSegmentUrl || q.url || '').trim());
      for (let i = 0; i < urls.length; i++) {
        if (!urls[i]) return { ok: false, message: 'كل جودة يجب أن تحتوي رابطاً لآخر شريحة (last segment URL).' };
      }
      for (let i = 0; i < urls.length; i++) {
        for (let j = i + 1; j < urls.length; j++) {
          if (urls[i] === urls[j]) return { ok: false, message: 'روابط الجودات لا يجب أن تكون متطابقة.' };
        }
      }

      // derive filename pattern and segment count by picking the numeric group with the largest numeric value
      const extracted = qualities.map((q, idx) => {
        const raw = String(q.lastSegmentUrl || q.url || '').trim();
        try {
          // use pathname last segment
          const parts = raw.split('/');
          const last = parts.pop() || '';
          const matches = [...last.matchAll(/\d+/g)];
          if (!matches.length) return { ok: false, index: idx, message: 'اسم الملف الأخير يجب أن يحتوي على رقم يمثل جزء الفيديو.' };
          // pick the numeric group with largest numeric value
          let best = matches[0];
          for (const m of matches) if (parseInt(m[0], 10) > parseInt(best[0], 10)) best = m;
          const digits = best[0];
          const pos = best.index;
          const pattern = last.slice(0, pos) + '{#}' + last.slice(pos + digits.length);
          const segmentCount = parseInt(digits, 10) || 1;
          return { ok: true, pattern, segmentCount };
        } catch (err) {
          return { ok: false, index: idx, message: 'تعذر تحليل رابط الجودة.' };
        }
      });

      for (const ex of extracted) if (!ex.ok) return { ok: false, message: ex.message || 'خطأ في تحليل الجودات.' };

      // ensure all patterns equal and segment counts equal
      const patterns = extracted.map((x) => x.pattern);
      const segs = extracted.map((x) => x.segmentCount);
      const pat0 = patterns[0];
      for (const p of patterns) if (p !== pat0) return { ok: false, message: 'نمط أسماء الأجزاء غير متطابق بين الجودات. تأكد أن اسم الجزء مثل segment-428-v1-a1.ts يظهر بنفس الموضع لكل جودة.' };
      const seg0 = segs[0];
      for (const s of segs) if (s !== seg0) return { ok: false, message: 'عدد الأجزاء الظاهر في رابط الجودات غير متساوٍ — يجب أن تكون الأجزاء متساوية بين الجودات.' };

      return { ok: true };
    };

    const vres = validateQualities(videoFormData.qualities);
    if (!vres.ok) {
      toast.error(vres.message || 'خطأ في بيانات الجودات');
      return;
    }
    try {
      setIsUploadingVideo(true);
      const h = Number(videoFormData.hours) || 0;
      const m = Number(videoFormData.minutes) || 0;
      const s = Number(videoFormData.seconds) || 0;
      const totalSeconds = h * 3600 + m * 60 + s;

      const payload = {
        title: videoFormData.title,
        duration: totalSeconds,
        qualities: videoFormData.qualities,
      };

      if (editingVideo) {
        // Try update existing video; backend may use /api/videos/:id or /api/admin/videos/:id
        await api
          .put(`/api/videos/${editingVideo._id}`, payload)
          .catch(async () => {
            await api.put(`/api/admin/videos/${editingVideo._id}`, payload);
          });
        // validation subsystem removed; just reload videos
        try {
          await loadVideos();
        } catch (e) {
          console.error('reload videos failed', e);
        }
        // trigger a recheck for the edited video so status is updated
        try {
          const vid = String(editingVideo._id);
          // optimistic UI: mark checking
          setVideoStatusMap((s) => ({ ...(s || {}), [vid]: 'checking' }));
          // fire-and-forget recheck; we'll refresh statuses shortly
          adminAPI.recheckVideo(vid).then(() => {
            toast.success(`بدأنا إعادة الفحص لـ "${editingVideo.title || vid}"`);
            setTimeout(() => fetchStatuses(), 2000);
          }).catch((err) => {
            console.error('recheck after edit failed', err);
            // ensure we synchronize
            fetchStatuses();
          });
        } catch (e) {
          // ignore
        }
        setEditingVideo(null);
      } else {
        await videosAPI.createVideo(
          payload.title,
          payload.duration,
          lectureId,
          payload.qualities,
        );
        setShowVideoForm(false);
      }

      setVideoFormData({
        title: "",
        duration: 0,
        hours: "",
        minutes: "",
        seconds: "",
        qualities: [{ quality: "360", lastSegmentUrl: "" }],
      });
      await loadVideos();
    } catch (err) {
      console.error("Video save error", err);
      alert("فشل إضافة/تحديث الفيديو");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // Video deletion and form reset removed - video functionality has been removed from the project

  const handleDeletePdf = async (pdfId) => {
    setDeleteTarget({ type: "pdf", id: pdfId, name: "الملف" });
  };

  const handleDeleteVideo = (videoId) => {
    setDeleteTarget({ type: "video", id: videoId, name: "الفيديو" });
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === "lecture") {
        await lecturesAPI.deleteLecture(deleteTarget.id);
        toast.success("تم حذف المحاضرة بنجاح ✅");
        navigate(
          `/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}`,
        );
      } else if (deleteTarget.type === "pdf") {
        await pdfsAPI.deletePdf(deleteTarget.id);
        toast.success("تم حذف الملف بنجاح ✅");
        await loadPdfs();
      } else if (deleteTarget.type === "video") {
        await videosAPI.deleteVideo(deleteTarget.id);
        toast.success("تم حذف الفيديو بنجاح ✅");
        await loadVideos();
      }
    } catch (err) {
      console.error("Delete error", err);
      toast.error(err?.response?.data?.message || "فشل الحذف ❌");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Video form reset removed - video functionality has been removed from the project

  const resetPdfForm = () => {
    setPdfFormData({ title: "", url: "" });
    setShowPdfForm(false);
    setEditingPdf(null);
  };

  // Video edit handler removed - video functionality has been removed from the project

  const handleEditPdf = (pdf) => {
    setEditingPdf(pdf);
    setPdfFormData({
      title: pdf.title,
      url: pdf.url,
    });
    setShowPdfForm(true);
    setActiveTab("pdfs");
  };

  const handleEditVideo = (video) => {
    setEditingVideo(video);
    const total = Number(video.duration) || 0;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    setVideoFormData({
      title: video.title || "",
      duration: video.duration || 0,
      hours,
      minutes,
      seconds,
      qualities:
        video.qualities && video.qualities.length
          ? video.qualities
          : [{ quality: "360", lastSegmentUrl: "" }],
    });
    setShowVideoForm(false);
    setActiveTab("videos");
  };

  const fetchPdfViewers = async (pdfId) => {
    if (!pdfId) return;
    if (pdfViewersMap[pdfId]) return;
    try {
      setPdfViewersLoadingId(pdfId);
      const res = await pdfsAPI.getPdfViewers(pdfId);
      setPdfViewersMap((m) => ({ ...m, [pdfId]: res.data || [] }));
    } catch (err) {
      // Error fetching PDF viewers (handled by UI)
    } finally {
      setPdfViewersLoadingId(null);
    }
  };

  const fetchVideoViewers = async (videoId) => {
    if (!videoId) return;
    if (videoViewersMap[videoId]) return;
    try {
      setVideoViewersLoadingId(videoId);
      const res = await videosAPI.getVideoViewers(videoId);
      setVideoViewersMap((m) => ({ ...m, [videoId]: res.data || [] }));
    } catch (err) {
      // Error fetching video viewers (handled by UI)
    } finally {
      setVideoViewersLoadingId(null);
    }
  };

  const fetchVideoDownloads = async (videoId) => {
    if (!videoId) return;
    if (videoDownloadsMap[videoId]) return;
    try {
      setVideoDownloadsLoadingId(videoId);
      const res = await videosAPI.getVideoDownloads(videoId);
      setVideoDownloadsMap((m) => ({ ...m, [videoId]: res.data || [] }));
    } catch (err) {
      // ignore
    } finally {
      setVideoDownloadsLoadingId(null);
    }
  };

  // Close viewers popovers when clicking outside any viewer button/popover
  useEffect(() => {
    const handleDocClick = (e) => {
      let el = e.target;
      while (el) {
        if (
          el.dataset &&
          (el.dataset.viewerPopover === "true" ||
            el.dataset.viewerButton === "true")
        )
          return;
        el = el.parentElement;
      }
      setActivePdfId(null);
      setVideoPopover(null);
      setPdfPopover(null);
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // Fetch current video statuses from server-side authoritative field
  // Fetch current video statuses from server-side authoritative field
  const fetchStatuses = async () => {
    try {
      const res = await videosAPI.getLectureAvailability(lectureId);
      const data = res?.data || null;
      if (data && data.perVideo) {
        setVideoStatusMap(data.perVideo);
      }
    } catch (e) {
      // ignore availability fetch errors
    }
  };

  useEffect(() => {
    let mounted = true;
    if (lectureId) {
      fetchStatuses();
    }
    return () => { mounted = false; };
  }, [lectureId]);

  const handleRecheckVideo = async (video) => {
    if (!video || !video._id) return;
    const id = String(video._id);
    // optimistic
    setVideoStatusMap((s) => ({ ...(s || {}), [id]: 'checking' }));
    try {
      await adminAPI.recheckVideo(id);
      toast.success(`بدأنا إعادة الفحص لـ "${video.title || id}"`);
      // fetch updated statuses after short delay
      setTimeout(() => fetchStatuses(), 2000);
    } catch (e) {
      console.error('recheck failed', e);
      toast.error('فشل إعادة الفحص');
      // refetch to sync
      fetchStatuses();
    }
  };

  // Video viewers fetching removed - video functionality has been removed from the project

  const breadcrumbs = [
    { label: "المواد", path: "/admin/content/materials" },
    { label: "المدرّسون", path: `/admin/content/materials/${materialId}` },
    {
      label: "الفصول",
      path: `/admin/content/materials/${materialId}/instructors/${instructorId}`,
    },
    {
      label: "المحاضرات",
      path: `/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}`,
    },
    {
      label: lectureLoading ? "جاري التحميل..." : lecture?.title || "المحاضرة",
      path: `/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}/lectures/${lectureId}`,
    },
  ];

  if (lectureLoading && !lecture) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative">
            <div className="w-20 h-20 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
          </div>
          <p className="mt-6 text-lg text-white/80">جاري تحميل المحاضرة...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-full mb-6">
            <X className="w-12 h-12 text-red-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">{error}</h3>
          <button
            onClick={() => navigate("/admin/content/materials")}
            className="mt-6 px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            العودة للمواد
          </button>
        </motion.div>
      </div>
    );
  }

  if (!lecture) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-6">📚</div>
          <h3 className="text-2xl font-bold text-white mb-3">
            المحاضرة غير موجودة
          </h3>
          <p className="text-white/60 mb-6">
            المحاضرة التي تبحث عنها غير موجودة أو تم حذفها
          </p>
          <button
            onClick={() =>
              navigate(
                `/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}`,
              )
            }
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            العودة إلى المحاضرات
          </button>
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <div className="min-h-screen p-6">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-8"
        >
          <AdminBreadcrumb items={breadcrumbs} />

          {/* Lecture Header */}
          <motion.div variants={itemVariants}>
            <div className="admin-card p-8 bg-gradient-to-r from-gray-800/60 via-gray-900/60 to-gray-800/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="flex items-center gap-6 mb-4 md:mb-0">
                  {(lecture?.thumbnailUrl || lecture?.thumbnail) && (
                    <div className="w-20 sm:w-24 md:w-28 h-20 sm:h-24 md:h-28 rounded-2xl overflow-hidden border-2 border-white/10">
                      <img
                        src={lecture.thumbnailUrl || lecture.thumbnail}
                        alt={lecture.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                      {lecture.title}
                    </h1>
                    <p className="text-white/60 text-sm mt-1">
                      المعرف: {lecture._id.slice(0, 8)}...
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 bg-gray-900/40 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-white/10">
                  <div className="text-center px-3 py-1 w-full sm:w-auto">
                    <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      {pdfs.length}
                    </div>
                    <div className="text-sm text-white/70">الملفات</div>
                  </div>
                  <div className="text-center px-3 py-1 w-full sm:w-auto">
                    <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                      {videos.length}
                    </div>
                    <div className="text-sm text-white/70">عدد الفيديوهات</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tabs Navigation */}
          <motion.div variants={itemVariants}>
            <div className="admin-card p-2 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl">
              <div className="flex space-x-2 rtl:space-x-reverse overflow-x-auto no-scrollbar py-2">
                <button
                  onClick={() => setActiveTab("videos")}
                  className={`min-w-[140px] flex-shrink-0 sm:flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    activeTab === "videos"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                      : "text-white/60 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <FileDown className="w-5 h-5" />
                  الفيديوهات ({videos.length})
                </button>
                <button
                  onClick={() => setActiveTab("pdfs")}
                  className={`min-w-[140px] flex-shrink-0 sm:flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    activeTab === "pdfs"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                      : "text-white/60 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  الملفات ({pdfs.length})
                </button>
                <button
                  onClick={() => setActiveTab("info")}
                  className={`min-w-[140px] flex-shrink-0 sm:flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                    activeTab === "info"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                      : "text-white/60 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <Info className="w-5 h-5" />
                  معلومات المحاضرة
                </button>
              </div>
            </div>
          </motion.div>

          {/* Tab Content */}
          <div className="admin-card bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-8">
              <AnimatePresence mode="wait">
                {/* Info Tab */}
                {activeTab === "info" && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Info className="w-6 h-6 text-cyan-400" />
                            معلومات المحاضرة
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingLectureTitle(true);
                                setLectureTitleInput(lecture.title);
                                setLectureEditThumbnail(
                                  lecture.thumbnailUrl ||
                                    lecture.thumbnail ||
                                    "",
                                );
                              }}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-300"
                              title="تعديل اسم المحاضرة"
                            >
                              <Edit3 className="w-5 h-5 text-white/80" />
                            </button>
                            <button
                              onClick={handleLectureDelete}
                              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors duration-300"
                              title="حذف المحاضرة"
                            >
                              <Trash2 className="w-5 h-5 text-red-400" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 backdrop-blur-sm">
                            <div className="text-sm text-white/50 mb-1">
                              اسم المحاضرة
                            </div>
                            <div>
                              {!editingLectureTitle ? (
                                <div className="text-lg font-semibold text-white">
                                  {lecture.title}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex gap-2 items-center">
                                    <input
                                      className="px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg flex-1 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                      value={lectureTitleInput}
                                      onChange={(e) =>
                                        setLectureTitleInput(e.target.value)
                                      }
                                    />
                                    <button
                                      onClick={handleLectureSave}
                                      className="px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-200"
                                    >
                                      حفظ
                                    </button>
                                    <button
                                      onClick={() =>
                                        setEditingLectureTitle(false)
                                      }
                                      className="px-3 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                    >
                                      إلغاء
                                    </button>
                                  </div>

                                  <div>
                                    <label className="block text-sm text-white/80 mb-2">
                                      صورة المحاضرة
                                    </label>
                                    <CloudinaryImageInput
                                      value={lectureEditThumbnail}
                                      onChange={(val) =>
                                        setLectureEditThumbnail(val)
                                      }
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 backdrop-blur-sm">
                            <div className="text-sm text-white/50 mb-1">
                              معرف المحاضرة
                            </div>
                            <div className="font-mono text-white/80 break-all">
                              {lecture._id}
                            </div>
                          </div>
                          {lecture.description && (
                            <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 backdrop-blur-sm">
                              <div className="text-sm text-white/50 mb-1">
                                الوصف
                              </div>
                              <div className="text-white/80">
                                {lecture.description}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                          <BarChart3 className="w-6 h-6 text-emerald-400" />
                          إحصائيات
                        </h3>
                        <div className="space-y-4">
                          <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border-l-4 border-emerald-400">
                            <div className="text-2xl font-bold text-emerald-300">
                              {pdfs.length}
                            </div>
                            <div className="text-sm text-emerald-200">
                              عدد الملفات
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border-l-4 border-cyan-400">
                            <div className="text-2xl font-bold text-cyan-300">
                              {videos.length}
                            </div>
                            <div className="text-sm text-cyan-200">
                              عدد الفيديوهات
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl p-4 border-l-4 border-orange-400">
                            <div className="text-2xl font-bold text-orange-300">
                              {formatHMS(totalVideoDuration)}
                            </div>
                            <div className="text-sm text-orange-200">
                              إجمالي مدة الفيديوهات
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "videos" && (
                  <motion.div
                    key="videos"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        فيديوهات المحاضرة
                      </h2>
                      <p className="text-white/60">
                        أضف أو شغّل فيديوهات مرتبطة بهذه المحاضرة (TS segments)
                      </p>
                    </div>

                    {videosLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <div className="w-16 h-16 border-4 border-white/10 border-t-emerald-400 rounded-full animate-spin mx-auto"></div>
                          <p className="mt-6 text-white/60">
                            جاري تحميل الفيديوهات...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* بطاقات الفيديوهات الحالية */}
                          {videos.map((video, index) => (
                            <React.Fragment key={video._id}>
                              {editingVideo &&
                              editingVideo._id === video._id ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-6 backdrop-blur-sm border border-cyan-500/20"
                                >
                                  <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-white">
                                      تعديل الفيديو
                                    </h3>
                                    <button
                                      onClick={() => setEditingVideo(null)}
                                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                      <X className="w-5 h-5 text-white/80" />
                                    </button>
                                  </div>
                                  <form
                                    onSubmit={handleVideoSubmit}
                                    className="space-y-4"
                                  >
                                    <div>
                                      <label className="block text-sm font-medium text-white/80 mb-2">
                                        عنوان الفيديو
                                      </label>
                                      <input
                                        required
                                        value={videoFormData.title}
                                        onChange={(e) =>
                                          setVideoFormData({
                                            ...videoFormData,
                                            title: e.target.value,
                                          })
                                        }
                                        className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                        placeholder="أدخل عنوان الفيديو"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-white/80 mb-2">
                                        المدة (ساعة:دقيقة:ثانية)
                                      </label>
                                      <div className="grid grid-cols-3 gap-2">
                                        <input
                                          type="number"
                                          min={0}
                                          value={videoFormData.hours}
                                          onChange={(e) =>
                                            setVideoFormData({
                                              ...videoFormData,
                                              hours: e.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                          placeholder="ساعات"
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          max={59}
                                          value={videoFormData.minutes}
                                          onChange={(e) =>
                                            setVideoFormData({
                                              ...videoFormData,
                                              minutes: e.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                          placeholder="دقائق"
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          max={59}
                                          value={videoFormData.seconds}
                                          onChange={(e) =>
                                            setVideoFormData({
                                              ...videoFormData,
                                              seconds: e.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                          placeholder="ثواني"
                                        />
                                      </div>
                                      <div className="mt-2 text-sm text-white/60">
                                        المجموع:{" "}
                                        {Math.floor(
                                          (Number(videoFormData.hours) || 0) *
                                            3600 +
                                            (Number(videoFormData.minutes) ||
                                              0) *
                                              60 +
                                            (Number(videoFormData.seconds) ||
                                              0),
                                        )}{" "}
                                        ثانية
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-white/80 mb-2">
                                        الجودات
                                      </label>
                                      {videoFormData.qualities.map((q, idx) => (
                                        <div
                                          key={idx}
                                          className="grid grid-cols-12 gap-2 mb-2 items-center"
                                        >
                                          <input
                                            value={q.quality}
                                            onChange={(e) => {
                                              const arr = [
                                                ...videoFormData.qualities,
                                              ];
                                              arr[idx].quality = e.target.value;
                                              setVideoFormData({
                                                ...videoFormData,
                                                qualities: arr,
                                              });
                                            }}
                                            className="col-span-3 px-2 py-1 bg-white/5 border border-white/10 rounded text-white"
                                            placeholder="الجودة"
                                          />
                                          <input
                                            value={q.lastSegmentUrl}
                                            onChange={(e) => {
                                              const arr = [
                                                ...videoFormData.qualities,
                                              ];
                                              arr[idx].lastSegmentUrl =
                                                e.target.value;
                                              setVideoFormData({
                                                ...videoFormData,
                                                qualities: arr,
                                              });
                                            }}
                                            className="col-span-8 px-2 py-1 bg-white/5 border border-white/10 rounded text-white"
                                            placeholder="آخر شريحة (.ts) URL"
                                          />
                                          <div className="col-span-1 flex items-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const arr = [
                                                  ...videoFormData.qualities,
                                                ];
                                                arr.splice(idx, 1);
                                                setVideoFormData({
                                                  ...videoFormData,
                                                  qualities: arr,
                                                });
                                              }}
                                              className="w-full p-1 bg-red-500/80 hover:bg-red-500 text-white rounded"
                                              title="حذف الجودة"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = getNextQuality(
                                              videoFormData.qualities,
                                            );
                                            setVideoFormData({
                                              ...videoFormData,
                                              qualities: [
                                                ...videoFormData.qualities,
                                                { quality: next, lastSegmentUrl: "" },
                                              ],
                                            });
                                          }}
                                          className="px-3 py-1 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm"
                                        >
                                          + إضافة جودة
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                      <button
                                        type="button"
                                        onClick={() => setEditingVideo(null)}
                                        className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                      >
                                        إلغاء
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={isUploadingVideo}
                                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                      >
                                        {isUploadingVideo ? "جارٍ..." : "حفظ"}
                                      </button>
                                    </div>
                                  </form>
                                </motion.div>
                              ) : (
                                <motion.div
                                  key={video._id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  whileHover={{ y: -5 }}
                                  id={`video-${video._id}`}
                                  className={`group relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 ${(() => {
                                    const st = (videoStatusMap && videoStatusMap[String(video._id)]) || video.status || 'unknown';
                                    if (st === 'working') return 'ring-4 ring-emerald-400/30';
                                    if (st === 'broken') return 'ring-4 ring-red-500/25';
                                    return '';
                                  })()}`}
                                >
                                  <div className="flex gap-6 items-center">
                                    {/* Content Left */}
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3 mb-4">
                                        <span className="px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold rounded-full shadow">
                                          فيديو #{index + 1}
                                        </span>
                                        {(() => {
                                          const st = (videoStatusMap && videoStatusMap[String(video._id)]) || video.status || 'unknown';
                                          if (st === 'working') return (<span className="ml-2 inline-flex items-center gap-2 px-2 py-1 bg-emerald-500 text-white rounded text-xs">شغال</span>);
                                          if (st === 'broken') return (<span className="ml-2 inline-flex items-center gap-2 px-2 py-1 bg-red-500 text-white rounded text-xs">معطل</span>);
                                          if (st === 'checking') return (<span className="ml-2 inline-flex items-center gap-2 px-2 py-1 bg-amber-500 text-white rounded text-xs">جارٍ التحقق</span>);
                                          return (<span className="ml-2 inline-flex items-center gap-2 px-2 py-1 bg-gray-500 text-white rounded text-xs">غير معروف</span>);
                                        })()}
                                        <span className="text-xs text-white/50">
                                          #{video._id.slice(0, 8)}
                                        </span>
                                      </div>

                                      <h4 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors duration-300 line-clamp-2">
                                        {video.title}
                                      </h4>

                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-white/60">
                                          <Clock className="w-4 h-4" />
                                          <span>
                                            المدة:{" "}
                                            {video.duration
                                              ? formatHMS(video.duration)
                                              : "غير محدد"}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-white/60">
                                          <div className="flex items-center gap-2">
                                            <BarChart3 className="w-4 h-4" />
                                            <span>
                                              الجودات:{" "}
                                              {video.qualities
                                                .map((q) => q.quality)
                                                .join(" ، ")}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                        <button
                                          onClick={() => {
                                            setSelectedVideo(video);
                                            setShowVideoModal(true);
                                          }}
                                          className="w-full sm:w-auto text-sm px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 group/play"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          <span>تشغيل الفيديو</span>
                                          <ChevronRight className="w-3 h-3 group-hover/play:translate-x-0.5 transition-transform" />
                                        </button>

                                        {/* viewers badge + hover tooltip */}
                                        <div className="ml-2 relative">
                                          <button
                                            data-viewer-button="true"
                                            onClick={(e) => {
                                              const rect =
                                                e.currentTarget.getBoundingClientRect();
                                              if (
                                                videoPopover &&
                                                videoPopover.videoId ===
                                                  video._id
                                              ) {
                                                setVideoPopover(null);
                                              } else {
                                                setVideoPopover({
                                                  videoId: video._id,
                                                  left: rect.left,
                                                  top: rect.bottom,
                                                  width: rect.width,
                                                });
                                                fetchVideoViewers(video._id);
                                              }
                                            }}
                                            className="w-full sm:w-auto flex items-center gap-2 text-sm text-white/70 px-2 py-1 bg-white/5 rounded-lg justify-center"
                                            title="مشاهدو الفيديو"
                                          >
                                            <Eye className="w-4 h-4 text-emerald-300" />
                                            <span>
                                              {
                                                (
                                                  videoViewersMap[video._id] ||
                                                  []
                                                ).length
                                              }
                                            </span>
                                          </button>
                                        </div>

                                        <div className="ml-2 relative">
                                          <button
                                            data-viewer-button="true"
                                            onClick={(e) => {
                                              const rect =
                                                e.currentTarget.getBoundingClientRect();
                                              if (
                                                videoPopover &&
                                                videoPopover.videoId ===
                                                  `dl-${video._id}`
                                              ) {
                                                setVideoPopover(null);
                                              } else {
                                                setVideoPopover({
                                                  videoId: `dl-${video._id}`,
                                                  left: rect.left,
                                                  top: rect.bottom,
                                                  width: rect.width,
                                                });
                                                fetchVideoDownloads(video._id);
                                              }
                                            }}
                                            className="w-full sm:w-auto flex items-center gap-2 text-sm text-white/70 px-2 py-1 bg-white/5 rounded-lg justify-center"
                                            title="من حمل الفيديو"
                                          >
                                            <FileDown className="w-4 h-4 text-sky-300" />
                                            <span>
                                              {
                                                (
                                                  videoDownloadsMap[
                                                    video._id
                                                  ] || []
                                                ).length
                                              }
                                            </span>
                                          </button>
                                        </div>

                                        <div className="flex items-center gap-2 ml-auto">
                                          

                                          <button
                                            onClick={() =>
                                              handleEditVideo(video)
                                            }
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                            title="تعديل"
                                          >
                                            <Edit3 className="w-4 h-4 text-white/70" />
                                          </button>

                                          <button
                                            onClick={() =>
                                              handleDeleteVideo(video._id)
                                            }
                                            className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="حذف"
                                          >
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Icon Right */}
                                    <div className="w-full sm:w-20 h-20 flex-shrink-0 mt-4 sm:mt-0 rounded-xl bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-2 border-white/10 group-hover:border-cyan-500/30 transition-colors duration-300 flex items-center justify-center">
                                      <div className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                                        <FileDown className="w-8 h-8 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </React.Fragment>
                          ))}

                          {/* بطاقة إضافة فيديو جديد - تتحول إلى فورم عند النقر */}
                          {showVideoForm ? (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-6 backdrop-blur-sm border border-cyan-500/20"
                            >
                              <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white">
                                  إضافة فيديو جديد
                                </h3>
                                <button
                                  onClick={() => setShowVideoForm(false)}
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <X className="w-5 h-5 text-white/80" />
                                </button>
                              </div>
                              <form
                                onSubmit={handleVideoSubmit}
                                className="space-y-4"
                              >
                                <div>
                                  <label className="block text-sm font-medium text-white/80 mb-2">
                                    عنوان الفيديو
                                  </label>
                                  <input
                                    required
                                    value={videoFormData.title}
                                    onChange={(e) =>
                                      setVideoFormData({
                                        ...videoFormData,
                                        title: e.target.value,
                                      })
                                    }
                                    className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                    placeholder="أدخل عنوان الفيديو"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-white/80 mb-2">
                                    المدة (ساعة:دقيقة:ثانية)
                                  </label>
                                  <div className="grid grid-cols-3 gap-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={videoFormData.hours}
                                      onChange={(e) =>
                                        setVideoFormData({
                                          ...videoFormData,
                                          hours: e.target.value,
                                        })
                                      }
                                      className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                      placeholder="ساعات"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      max={59}
                                      value={videoFormData.minutes}
                                      onChange={(e) =>
                                        setVideoFormData({
                                          ...videoFormData,
                                          minutes: e.target.value,
                                        })
                                      }
                                      className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                      placeholder="دقائق"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      max={59}
                                      value={videoFormData.seconds}
                                      onChange={(e) =>
                                        setVideoFormData({
                                          ...videoFormData,
                                          seconds: e.target.value,
                                        })
                                      }
                                      className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                      placeholder="ثواني"
                                    />
                                  </div>
                                  <div className="mt-2 text-sm text-white/60">
                                    المجموع:{" "}
                                    {Math.floor(
                                      (Number(videoFormData.hours) || 0) *
                                        3600 +
                                        (Number(videoFormData.minutes) || 0) *
                                          60 +
                                        (Number(videoFormData.seconds) || 0),
                                    )}{" "}
                                    ثانية
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-white/80 mb-2">
                                    الجودات
                                  </label>
                                  {videoFormData.qualities.map((q, idx) => (
                                    <div
                                      key={idx}
                                      className="grid grid-cols-12 gap-2 mb-2 items-center"
                                    >
                                      <input
                                        value={q.quality}
                                        onChange={(e) => {
                                          const arr = [
                                            ...videoFormData.qualities,
                                          ];
                                          arr[idx].quality = e.target.value;
                                          setVideoFormData({
                                            ...videoFormData,
                                            qualities: arr,
                                          });
                                        }}
                                        className="col-span-3 px-2 py-1 bg-white/5 border border-white/10 rounded text-white"
                                        placeholder="الجودة"
                                      />
                                      <input
                                        value={q.lastSegmentUrl}
                                        onChange={(e) => {
                                          const arr = [
                                            ...videoFormData.qualities,
                                          ];
                                          arr[idx].lastSegmentUrl =
                                            e.target.value;
                                          setVideoFormData({
                                            ...videoFormData,
                                            qualities: arr,
                                          });
                                        }}
                                        className="col-span-8 px-2 py-1 bg-white/5 border border-white/10 rounded text-white"
                                        placeholder="آخر شريحة (.ts) URL"
                                      />
                                      <div className="col-span-1 flex items-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const arr = [
                                              ...videoFormData.qualities,
                                            ];
                                            arr.splice(idx, 1);
                                            setVideoFormData({
                                              ...videoFormData,
                                              qualities: arr,
                                            });
                                          }}
                                          className="w-full p-1 bg-red-500/80 hover:bg-red-500 text-white rounded"
                                          title="حذف الجودة"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = getNextQuality(videoFormData.qualities);
                                        setVideoFormData({
                                          ...videoFormData,
                                          qualities: [
                                            ...videoFormData.qualities,
                                            { quality: next, lastSegmentUrl: "" },
                                          ],
                                        });
                                      }}
                                      className="px-3 py-1 bg-white/10 text-white rounded hover:bg-white/20 transition-colors text-sm"
                                    >
                                      + إضافة جودة
                                    </button>
                                  </div>
                                </div>

                                <div className="flex justify-end gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setShowVideoForm(false)}
                                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                  >
                                    إلغاء
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isUploadingVideo}
                                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {isUploadingVideo ? "جارٍ..." : "إضافة"}
                                  </button>
                                </div>
                              </form>
                            </motion.div>
                          ) : (
                            <div
                              onClick={() => {
                                setShowVideoForm(true);
                                setVideoFormData({
                                  title: "",
                                  duration: 0,
                                  hours: "",
                                  minutes: "",
                                  seconds: "",
                                  qualities: [
                                    { quality: "360", lastSegmentUrl: "" },
                                  ],
                                });
                              }}
                              className="group relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500"
                            >
                              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                                {/* Content Left */}
                                <div className="flex-1">
                                  <div className="mb-4">
                                    <span className="px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold rounded-full shadow">
                                      جديد
                                    </span>
                                  </div>

                                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors duration-300">
                                    إضافة فيديو جديد
                                  </h3>

                                  <p className="text-white/60 text-sm mb-6">
                                    أضف فيديو جديد لهذه المحاضرة
                                  </p>

                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-cyan-400">
                                      <Plus className="w-5 h-5" />
                                      <span className="text-sm font-medium">
                                        انقر للبدء
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Icon Right */}
                                <div className="w-full sm:w-20 h-20 flex-shrink-0 mt-4 sm:mt-0 rounded-xl bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border-2 border-cyan-500/20 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors duration-300">
                                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                                    <FileDown className="w-8 h-8 text-white" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* PDFs Tab */}
                {activeTab === "pdfs" && (
                  <motion.div
                    key="pdfs"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        ملفات المحاضرة
                      </h2>
                      <p className="text-white/60">
                        إدارة وعرض جميع ملفات PDF للمحاضرة
                      </p>
                    </div>

                    {/* PDFs List */}
                    {pdfsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <div className="w-16 h-16 border-4 border-white/10 border-t-emerald-400 rounded-full animate-spin mx-auto"></div>
                          <p className="mt-6 text-white/60">
                            جاري تحميل الملفات...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {pdfs.map((pdf, index) => (
                          <React.Fragment key={pdf._id}>
                            {editingPdf && editingPdf._id === pdf._id ? (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl p-6 backdrop-blur-sm border border-emerald-500/20"
                              >
                                <div className="flex items-center justify-between mb-6">
                                  <h3 className="text-lg font-bold text-white">
                                    تعديل الملف
                                  </h3>
                                  <button
                                    onClick={resetPdfForm}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  >
                                    <X className="w-5 h-5 text-white/80" />
                                  </button>
                                </div>
                                <form
                                  onSubmit={handlePdfSubmit}
                                  className="space-y-4"
                                >
                                  <div>
                                    <label className="block text-sm font-medium text-white/80 mb-2">
                                      عنوان الملف
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      value={pdfFormData.title}
                                      onChange={(e) =>
                                        setPdfFormData({
                                          ...pdfFormData,
                                          title: e.target.value,
                                        })
                                      }
                                      className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                                    />
                                  </div>
                                  <div>
                                    <PDFUpload
                                      value={pdfFormData.url}
                                      onChange={(urlOrFile) =>
                                        setPdfFormData({
                                          ...pdfFormData,
                                          url: urlOrFile,
                                        })
                                      }
                                      label="رفع ملف PDF"
                                      autoUpload={false}
                                    />
                                  </div>
                                  <div className="flex justify-end gap-3">
                                    <button
                                      type="button"
                                      onClick={resetPdfForm}
                                      className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                    >
                                      إلغاء
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={isUploadingPdf}
                                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                      {isUploadingPdf ? "جارٍ..." : "حفظ"}
                                    </button>
                                  </div>
                                </form>
                              </motion.div>
                            ) : (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ y: -5 }}
                                className="group relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500"
                              >
                                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                                  {/* Content Left */}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                      <span className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold rounded-full shadow">
                                        ملف #{index + 1}
                                      </span>
                                      <span className="text-xs text-white/50">
                                        #{pdf._id.slice(0, 8)}
                                      </span>
                                    </div>

                                    <h4 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors duration-300 line-clamp-2">
                                      {pdf.title}
                                    </h4>

                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-sm text-white/60">
                                        <FileText className="w-4 h-4" />
                                        <span>PDF ملف</span>
                                      </div>

                                      <div className="flex items-center gap-2 text-sm text-white/60">
                                        <button
                                          data-viewer-button="true"
                                          onClick={(e) => {
                                            const rect =
                                              e.currentTarget.getBoundingClientRect();
                                            if (
                                              pdfPopover &&
                                              pdfPopover.pdfId === pdf._id
                                            ) {
                                              setPdfPopover(null);
                                              setActivePdfId(null);
                                            } else {
                                              setPdfPopover({
                                                pdfId: pdf._id,
                                                left: rect.left,
                                                top: rect.bottom,
                                                width: rect.width,
                                              });
                                              setActivePdfId(pdf._id);
                                              fetchPdfViewers(pdf._id);
                                            }
                                          }}
                                          className="flex items-center gap-2 text-sm text-white/70 px-2 py-1 bg-white/5 rounded-lg"
                                          title="مشاهدو الملف"
                                        >
                                          <Eye className="w-4 h-4 text-emerald-300" />
                                          <span className="whitespace-nowrap">
                                            {pdf.viewCount || 0} مشاهدات
                                          </span>
                                        </button>
                                      </div>
                                    </div>

                                      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center gap-4">
                                      <a
                                        href={pdf.fileUrl || pdf.url || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(ev) => {
                                          ev.preventDefault();
                                          const url =
                                            pdf.fileUrl || pdf.url || "";
                                          try {
                                            const base =
                                              api?.defaults?.baseURL || "";
                                            const viewUrl = `${base}/api/pdfs/${pdf._id}/view`;
                                            if (
                                              navigator &&
                                              typeof navigator.sendBeacon ===
                                                "function"
                                            ) {
                                              const blob = new Blob(
                                                [JSON.stringify({})],
                                                { type: "application/json" },
                                              );
                                              navigator.sendBeacon(
                                                viewUrl,
                                                blob,
                                              );
                                            } else if (
                                              typeof fetch !== "undefined"
                                            ) {
                                              fetch(viewUrl, {
                                                method: "POST",
                                                keepalive: true,
                                                headers: {
                                                  "Content-Type":
                                                    "application/json",
                                                  "user-code":
                                                    localStorage.getItem(
                                                      "userCode",
                                                    ) || "",
                                                },
                                              }).catch(() => {});
                                            }
                                          } catch (err) {
                                            // viewPdf call failed (silenced)
                                          }
                                          if (pdf.fileUrl || pdf.url)
                                            window.open(
                                              pdf.fileUrl || pdf.url,
                                              "_blank",
                                            );
                                        }}
                                        className="text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors duration-200 flex items-center gap-2 group/view"
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>فتح الملف</span>
                                        <ChevronRight className="w-3 h-3 group-hover/view:translate-x-0.5 transition-transform" />
                                      </a>

                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto mt-3 sm:mt-0">
                                          <button
                                            onClick={() => handleEditPdf(pdf)}
                                            className="w-full sm:w-auto p-2 hover:bg-white/10 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                                            title="تعديل"
                                          >
                                            <Edit3 className="w-4 h-4 text-white/70" />
                                            <span className="hidden sm:inline">تعديل</span>
                                          </button>
                                          <button
                                            onClick={() => handleDeletePdf(pdf._id)}
                                            className="w-full sm:w-auto p-2 hover:bg-red-500/10 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                                            title="حذف"
                                          >
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                            <span className="hidden sm:inline">حذف</span>
                                          </button>
                                        </div>
                                    </div>
                                  </div>

                                  {/* Icon Right */}
                                  <div className="w-full sm:w-20 h-20 flex-shrink-0 mt-4 sm:mt-0 rounded-xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border-2 border-white/10 group-hover:border-emerald-500/30 transition-colors duration-300 flex items-center justify-center">
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                                      <FileText className="w-8 h-8 text-white" />
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </React.Fragment>
                        ))}

                        {/* Add PDF Card */}
                        {showPdfForm && !editingPdf ? (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl p-6 backdrop-blur-sm border border-emerald-500/20"
                          >
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="text-lg font-bold text-white">
                                إضافة ملف جديد
                              </h3>
                              <button
                                onClick={resetPdfForm}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <X className="w-5 h-5 text-white/80" />
                              </button>
                            </div>
                            <form
                              onSubmit={handlePdfSubmit}
                              className="space-y-4"
                            >
                              <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">
                                  عنوان الملف
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={pdfFormData.title}
                                  onChange={(e) =>
                                    setPdfFormData({
                                      ...pdfFormData,
                                      title: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                                  placeholder="أدخل عنوان الملف"
                                />
                              </div>
                              <div>
                                <PDFUpload
                                  value={pdfFormData.url}
                                  onChange={(urlOrFile) =>
                                    setPdfFormData({
                                      ...pdfFormData,
                                      url: urlOrFile,
                                    })
                                  }
                                  label="رفع ملف PDF"
                                  autoUpload={false}
                                />
                              </div>
                              <div className="flex justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={resetPdfForm}
                                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="submit"
                                  disabled={isUploadingPdf}
                                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {isUploadingPdf ? "جارٍ الرفع..." : "إضافة"}
                                </button>
                              </div>
                            </form>
                          </motion.div>
                        ) : (
                          !editingPdf && (
                            <div
                              onClick={() => {
                                setShowPdfForm(true);
                                setPdfFormData({ title: "", url: "" });
                              }}
                              className="group relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500"
                            >
                              <div className="flex gap-6 items-center">
                                {/* Content Left */}
                                <div className="flex-1">
                                  <div className="mb-4">
                                    <span className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold rounded-full shadow">
                                      جديد
                                    </span>
                                  </div>

                                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors duration-300">
                                    إضافة ملف جديد
                                  </h3>

                                  <p className="text-white/60 text-sm mb-6">
                                    أضف ملفاً جديداً لهذه المحاضرة
                                  </p>

                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-emerald-400">
                                      <Plus className="w-5 h-5" />
                                      <span className="text-sm font-medium">
                                        انقر للبدء
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Icon Right */}
                                <div className="w-full sm:w-20 h-20 flex-shrink-0 mt-4 sm:mt-0 rounded-xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border-2 border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors duration-300">
                                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                                    <FileDown className="w-8 h-8 text-white" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Video Player Modal */}
      <AnimatePresence>
        {showVideoModal && selectedVideo && (
          <motion.div
            key="video-modal"
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setShowVideoModal(false);
                setSelectedVideo(null);
              }}
            />
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              className="relative w-full max-w-4xl mx-4"
            >
              <div className="p-4">
                <div className="bg-transparent rounded-lg">
                  <div className="flex items-start justify-end mb-4">
                    <button
                      onClick={() => {
                        setShowVideoModal(false);
                        setSelectedVideo(null);
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-md text-white"
                    >
                      إغلاق
                    </button>
                  </div>
                  <div className="bg-black rounded-lg p-4">
                    <VideoPlayer video={selectedVideo} />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            key="delete-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              className="relative w-full max-w-lg mx-4"
            >
              <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">
                  تأكيد الحذف
                </h3>
                <p className="text-white/80 mb-6">
                  هل أنت متأكد من حذف {deleteTarget?.name}؟ هذا الإجراء لا يمكن
                  التراجع عنه.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={performDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg disabled:opacity-60"
                  >
                    {isDeleting ? "جارٍ الحذف..." : "حذف نهائي"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed popover rendered on top of all content to avoid clipping by overflow */}
      {videoPopover && (
        <div style={getPopoverStyle(videoPopover)}>
          <div
            data-viewer-popover="true"
            className="w-full sm:w-64 bg-gray-900/95 text-white text-sm rounded-lg p-3 border border-white/10 shadow-lg"
          >
            <div className="font-semibold text-white/90 mb-2">
              مشاهدات الفيديو (
              {(videoViewersMap[videoPopover.videoId] || []).length})
            </div>
            {videoViewersLoadingId === videoPopover.videoId ? (
              <div className="text-white/60">جارٍ التحميل...</div>
            ) : (videoViewersMap[videoPopover.videoId] || []).length === 0 ? (
              <div className="text-white/70">لا توجد مشاهدات حتى الآن.</div>
            ) : (
              <div className="space-y-2 viewer-scroll max-h-72 overflow-y-auto">
                {(videoViewersMap[videoPopover.videoId] || []).map((v) => (
                  <div key={v._id} className="flex items-start justify-between">
                    <div className="text-white/90">
                      {v.userId?.name || v.userName || "مستخدم"}
                    </div>
                    <div className="text-white/60 text-xs">
                      {new Date(v.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {pdfPopover && (
        <div style={getPopoverStyle(pdfPopover)}>
          <div
            data-viewer-popover="true"
            className="w-full sm:w-64 bg-gray-900/95 text-white text-sm rounded-lg p-3 border border-white/10 shadow-lg"
          >
            <div className="font-semibold text-white/90 mb-2">
              مشاهدات الملف ({(pdfViewersMap[pdfPopover.pdfId] || []).length})
            </div>
            {pdfViewersLoadingId === pdfPopover.pdfId ? (
              <div className="text-white/60">جارٍ التحميل...</div>
            ) : (pdfViewersMap[pdfPopover.pdfId] || []).length === 0 ? (
              <div className="text-white/70">لا توجد مشاهدات حتى الآن.</div>
            ) : (
              <div className="space-y-2 viewer-scroll max-h-72 overflow-y-auto">
                {(pdfViewersMap[pdfPopover.pdfId] || []).map((v) => (
                  <div
                    key={v._id || v.user?._id || v.userId}
                    className="text-sm text-white/80 px-2 py-1 border-b border-gray-700/50 last:border-0"
                  >
                    <div className="font-medium">
                      {v.name ||
                        v.code ||
                        v.user?.name ||
                        v.user?.code ||
                        v.userCode ||
                        v.user?.phone ||
                        "مستخدم"}
                    </div>
                    <div className="text-xs text-white/50">
                      {new Date(
                        v.createdAt ||
                          v.viewedAt ||
                          v.created_at ||
                          v.viewed_at,
                      ).toLocaleString("ar-SA")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LectureDetailWithMedia;
