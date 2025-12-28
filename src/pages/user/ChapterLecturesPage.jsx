import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  chapterAPI,
  pdfsAPI,
  videosAPI,
  lecturesAPI,
  materialAPI,
} from "../../utils/api";
import UserHeader from "../../components/user/UserHeader";
import UserFooter from "../../components/user/UserFooter";
import VideoPlayer from "../../components/VideoPlayer";
import {
  BookOpenIcon,
  ClockIcon,
  PlayCircleIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  XCircleIcon,
  ArrowPathIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import useTitle from "../../hooks/useTitle";

const API_BASE = import.meta.env.VITE_API_BASE;

const ChapterLecturesPage = () => {
  const navigate = useNavigate();
  const { chapterId, lectureId: routeLectureId } = useParams();
  const { user } = useAuth();
  const [chapter, setChapter] = useState(null);
  const [material, setMaterial] = useState(null);
  useTitle("كورساتي —  محتوي الفصل");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLectureId, setSelectedLectureId] = useState(null);
  const [unavailableModal, setUnavailableModal] = useState({ open: false, lecture: null, videos: [] });
  const [lectureAvailability, setLectureAvailability] = useState({});
  const [availLoadingIds, setAvailLoadingIds] = useState(new Set());
  const [showDebugAvail, setShowDebugAvail] = useState(false);
  const playerRef = React.useRef(null);

  // States for PDFs
  const [pdfs, setPdfs] = useState([]);
  const [pdfsLoading, setPdfsLoading] = useState(false);
  // States for Videos
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  // selected inline video to play
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    const loadChapter = async () => {
      try {
        setLoading(true);
        const response = await chapterAPI.getChapterById(chapterId);
        setChapter(response.data);
        // load material title if instructor -> materialId is available
        try {
          const matId = response.data?.instructorId?.materialId;
          if (matId) {
            const mres = await materialAPI.getMaterialById(matId);
            setMaterial(mres.data || null);
          } else {
            setMaterial(null);
          }
        } catch (e) {
          setMaterial(null);
        }
        try {
          const qp = new URLSearchParams(window.location.search);
          const l = routeLectureId || qp.get("lecture");
          if (l) {
            setSelectedLectureId(l);
          } else if (
            response.data?.lectures &&
            response.data.lectures.length > 0
          ) {
            // choose the most recent lecture by createdAt as default
            try {
              const sorted = (response.data.lectures || [])
                .slice()
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              if (sorted.length > 0) setSelectedLectureId(sorted[0]._id);
            } catch (e) {
              setSelectedLectureId(response.data.lectures[0]._id);
            }
          }
        } catch (e) {
          if (response.data?.lectures && response.data.lectures.length > 0) {
            setSelectedLectureId(response.data.lectures[0]._id);
          }
        }
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (chapterId) {
      loadChapter();
    }
  }, [chapterId]);

  // After chapter loads, fetch videos for lectures that don't embed `videos` so we can
  // compute availability badges on the lecture cards (show broken count or all-broken)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!chapter || !Array.isArray(chapter.lectures)) return;
        const availMap = {};
        // Fetch videos for lectures that don't include full `videos` arrays
        await Promise.all(
          chapter.lectures.map(async (lec) => {
            try {
              // Prefer authoritative server-side availability check for all lectures.
              try {
                const res = await videosAPI.getLectureAvailability(lec._id);
                const data = res && res.data;
                if (data && data.ok) {
                  const total = data.total || 0;
                  const broken = data.broken || 0;
                  availMap[lec._id] = { total, broken, allBroken: total > 0 && broken === total, perVideo: data.perVideo };
                  return;
                }
              } catch (e) {
                // fallback to local embedded videos when public endpoint fails
              }

              if (Array.isArray(lec.videos) && lec.videos.length > 0) {
                const vids = lec.videos;
                let broken = 0;
                const total = vids.length;
                vids.forEach((v) => {
                  const quals = Array.isArray(v.qualities) ? v.qualities : [];
                  const available = quals.some((q) => q && (q.lastSegmentUrl || q.url));
                  if (!available) broken += 1;
                });
                availMap[lec._id] = { total, broken, allBroken: total > 0 && broken === total };
              }
            } catch (e) {
              // ignore per-lecture fetch errors
            }
          }),
        );
        if (mounted) setLectureAvailability(availMap);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [chapter]);

  // تحميل ملفات PDF للمحاضرة المختارة
  useEffect(() => {
    const loadPDFs = async () => {
      if (!selectedLectureId) return;
      try {
        setPdfsLoading(true);
        const lectureFromChapter = chapter?.lectures?.find(
          (l) => l._id === selectedLectureId,
        );
        if (
          lectureFromChapter &&
          Array.isArray(lectureFromChapter.pdfs) &&
          lectureFromChapter.pdfs.length > 0
        ) {
          setPdfs(lectureFromChapter.pdfs);
        } else {
          const pdfsRes = await pdfsAPI.getPDFsByLecture(selectedLectureId);
          const pdfsData = pdfsRes.data || [];
          setPdfs(pdfsData);
        }
      } catch (err) {
        setPdfs([]);
      } finally {
        setPdfsLoading(false);
      }
    };

    loadPDFs();
  }, [selectedLectureId, chapter]);

  // load videos for selected lecture
  useEffect(() => {
    const loadVideos = async () => {
      if (!selectedLectureId) return;
      try {
        setVideosLoading(true);
        const lectureFromChapter = chapter?.lectures?.find(
          (l) => l._id === selectedLectureId,
        );
        // Ensure availability is verified before loading the lecture
        try {
          let la = lectureAvailability && lectureAvailability[selectedLectureId];
          if (!la) {
            try {
              const avRes = await videosAPI.getLectureAvailability(selectedLectureId);
              if (avRes && avRes.data && avRes.data.ok) {
                la = avRes.data;
                setLectureAvailability((prev) => ({ ...(prev || {}), [selectedLectureId]: la }));
              }
            } catch (e) {
              // ignore availability fetch errors and proceed to load videos normally
            }
          }
          if (la && la.allBroken) {
            // Show modal and do not load videos or allow playback
            setUnavailableModal({ open: true, lecture: lectureFromChapter || { _id: selectedLectureId, title: (lectureFromChapter && lectureFromChapter.title) || 'المحاضرة' }, videos: la.perVideo ? la.perVideo.filter(p => !p.available).map(p => ({ _id: p.videoId, title: p.videoId })) : [] });
            setVideos([]);
            setVideosLoading(false);
            return;
          }
        } catch (e) {
          // continue to load videos if availability check fails
        }
        if (
          lectureFromChapter &&
          Array.isArray(lectureFromChapter.videos) &&
          lectureFromChapter.videos.length > 0
        ) {
          setVideos(lectureFromChapter.videos);
        } else {
          const res = await videosAPI.getVideosByLecture(selectedLectureId);
          console.debug(
            "videosAPI.getVideosByLecture response for",
            selectedLectureId,
            res && res.data,
          );
          const vids = res.data || [];
          setVideos(vids);

          try {
            const qp = new URLSearchParams(window.location.search);
            const v = qp.get("video");
            if (v) {
              const found = vids.find((x) => String(x._id) === String(v));
              if (found) {
                setSelectedVideo(found);
                try {
                  await lecturesAPI.viewLecture(selectedLectureId);
                } catch (e) {}
                try {
                  await videosAPI.viewVideo(found._id);
                } catch (e) {}
              }
            }
          } catch (e) {}
        }
      } catch (err) {
        setVideos([]);
      } finally {
        setVideosLoading(false);
      }
    };
    loadVideos();
  }, [selectedLectureId, chapter]);

  // Scroll player into view when a video is selected
  useEffect(() => {
    if (selectedVideo && playerRef.current) {
      setTimeout(() => {
        try {
          playerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } catch (e) {}
      }, 80);
    }
  }, [selectedVideo]);

  // Scroll the selected lecture button into view when lecture changes
  useEffect(() => {
    if (!selectedLectureId) return;
    try {
      const el = document.getElementById(`lecture-${selectedLectureId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {}
  }, [selectedLectureId]);

  // تسجيل عرض PDF
  const handlePDFView = useCallback(async (pdfId) => {
    try {
      const userCode = localStorage.getItem("userCode");
      const url = `${API_BASE}/api/pdfs/${pdfId}/view`;

      if (userCode) {
        fetch(url, {
          method: "POST",
          headers: {
            "user-code": userCode,
            "Content-Type": "application/json",
          },
          keepalive: true,
          body: JSON.stringify({ timestamp: new Date().toISOString() }),
        }).catch(() => {});
      } else if (navigator.sendBeacon) {
        const data = new Blob(
          [
            JSON.stringify({
              anonymous: true,
              timestamp: new Date().toISOString(),
            }),
          ],
          { type: "application/json" },
        );
        navigator.sendBeacon(url, data);
      } else {
        fetch(url, {
          method: "POST",
          keepalive: true,
        }).catch(() => {});
      }
    } catch (err) {
      // failed to record PDF view (handled by UI)
    }
  }, []);

  const getLectureIcon = (lecture) => {
    if (lecture.pdfs?.length > 0)
      return <DocumentTextIcon className="w-4 h-4 text-purple-400" />;
    return <BookOpenIcon className="w-4 h-4 text-emerald-400" />;
  };

  const handleRetryAvailability = async () => {
    try {
      if (!unavailableModal || !unavailableModal.lecture) return;
      setUnavailableModal((s) => ({ ...(s || {}), checking: true }));
      const lectureId = unavailableModal.lecture._id;
      // try public availability endpoint
      let data = null;
      try {
        const res = await videosAPI.getLectureAvailability(lectureId);
        data = res && res.data;
      } catch (e) {
        data = null;
      }
      // If we couldn't get perVideo info from server, try to fetch video list
      let vids = unavailableModal.videos || [];
      if ((!vids || vids.length === 0) && (!data || !Array.isArray(data.perVideo))) {
        try {
          const vres = await videosAPI.getVideosByLecture(lectureId);
          vids = vres.data || [];
        } catch (e) {
          vids = [];
        }
      }

      // merge results into lectureAvailability state
      if (data && data.ok) {
        setLectureAvailability((prev) => ({ ...prev, [lectureId]: data }));
      }

      // Build updated broken list for modal (prefer authoritative perVideo)
      let brokenList = [];
      if (data && Array.isArray(data.perVideo)) {
        const map = {};
        data.perVideo.forEach((p) => { map[String(p.videoId)] = !!p.available; });
        // try to map existing vids to IDs, otherwise create placeholders
        if (vids && vids.length > 0) {
          brokenList = vids.filter((v) => !map[String(v._id)]).slice(0, 10);
        } else {
          brokenList = data.perVideo.filter((p) => !p.available).slice(0, 10).map((p) => ({ _id: p.videoId, title: p.videoId }));
        }
      } else if (vids && vids.length > 0) {
        const bad = vids.filter((v) => {
          const quals = Array.isArray(v.qualities) ? v.qualities : [];
          return !quals.some((q) => q && (q.lastSegmentUrl || q.url));
        });
        brokenList = bad.slice(0, 10);
      }

      setUnavailableModal({ open: true, lecture: unavailableModal.lecture, videos: brokenList, checking: false });
    } catch (err) {
      try { setUnavailableModal((s) => ({ ...(s || {}), checking: false })); } catch (e) {}
    }
  };

  // format seconds to H:MM:SS or M:SS
  const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds)) return "0:00";
    const sec = Math.floor(seconds);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0)
      return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const lectureTotalSeconds = (lecture) => {
    // prefer videos[] durations if present
    if (Array.isArray(lecture.videos) && lecture.videos.length > 0) {
      return lecture.videos.reduce((s, v) => s + (Number(v.duration) || 0), 0);
    }
    // fallback to lecture.duration (may be seconds)
    return Number(lecture.duration) || 0;
  };

  const chapterTotalSeconds = () => {
    if (!chapter || !Array.isArray(chapter.lectures)) return 0;
    return chapter.lectures.reduce((sum, l) => sum + lectureTotalSeconds(l), 0);
  };

  const chapterTotalVideos = () => {
    if (!chapter || !Array.isArray(chapter.lectures)) return 0;
    return chapter.lectures.reduce(
      (sum, l) => sum + (Array.isArray(l.videos) ? l.videos.length : 0),
      0,
    );
  };

  const sortedLectures = useMemo(() => {
    if (!chapter || !Array.isArray(chapter.lectures)) return [];
    try {
      return [...chapter.lectures]
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      return chapter.lectures;
    }
  }, [chapter]);

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-white/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/80 text-lg">جاري تحميل الفصل...</p>
          <p className="text-white/60 text-sm mt-2">معرّف الفصل: {chapterId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen " dir="rtl">
      {/* شريط التنقل العلوي */}
      <UserHeader showBackButton={true} />

      {/* Modal: lecture unavailable (all videos broken) */}
      {unavailableModal.open && (
        <div onClick={() => setUnavailableModal({ open: false, lecture: null, videos: [] })} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="unavail-title" className="bg-white/6 border border-white/12 rounded-2xl p-4 sm:p-6 max-w-3xl w-full text-right shadow-2xl">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-shrink-0 mt-1 flex items-start sm:items-center">
                <div className="w-14 h-14 rounded-full bg-red-700/20 flex items-center justify-center">
                  <XCircleIcon className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 id="unavail-title" className="text-lg sm:text-xl font-bold text-white">المحاضرة غير متاحة حالياً</h3>
                    <p className="text-white/70 mt-1 text-sm sm:text-base">نأسف للإزعاج — يبدو أن بعض أو كل فيديوهات هذه المحاضرة غير متاحة الآن. يمكنك إعادة محاولة التحقق أدناه أو المتابعة لرؤية المحتوى مع احتمال عدم تشغيل الفيديوهات.</p>
                  </div>
                  <div className="shrink-0">
                    <button onClick={() => setUnavailableModal({ open: false, lecture: null, videos: [] })} className="text-white/60 hover:text-white">إغلاق</button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <div className="px-2 py-1 bg-white/5 rounded text-white/90">معطلة: <span className="font-semibold">{(unavailableModal.videos && unavailableModal.videos.length) || (lectureAvailability && lectureAvailability[unavailableModal.lecture?._id]?.broken) || 0}</span></div>
                  <div className="px-2 py-1 bg-white/5 rounded text-white/90">مجموع الفيديوهات: <span className="font-semibold">{(unavailableModal.videos && unavailableModal.videos.length) || (lectureAvailability && lectureAvailability[unavailableModal.lecture?._id]?.total) || '—'}</span></div>
                </div>

                {unavailableModal.videos && unavailableModal.videos.length > 0 && (
                  <div className="mt-4 max-h-48 sm:max-h-52 overflow-auto text-sm text-white/80 space-y-2 pr-2">
                    {unavailableModal.videos.slice(0, 10).map((v) => (
                      <div key={v._id} className="flex justify-between items-center border-b border-white/5 pb-2">
                        <div className="truncate">{v.title || 'فيديو (بدون عنوان)'}</div>
                        <div className="text-xs text-white/50">{v.duration ? formatTime(v.duration) : ''}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleRetryAvailability}
                    disabled={!!unavailableModal.checking}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded w-full sm:w-auto ${unavailableModal.checking ? 'bg-white/8 text-white/60' : 'bg-white/10 text-white hover:bg-white/15'}`}
                  >
                    <ArrowPathIcon className={`w-5 h-5 ${unavailableModal.checking ? 'animate-spin' : ''}`} />
                    {unavailableModal.checking ? 'جاري التحقق...' : 'إعادة التحقق'}
                  </button>

                  <button
                    onClick={() => {
                      const id = unavailableModal.lecture && unavailableModal.lecture._id;
                      setUnavailableModal({ open: false, lecture: null, videos: [] });
                      if (id) {
                        setSelectedLectureId(id);
                        navigate(`/chapter/${chapterId}/lecture/${id}`);
                      }
                    }}
                    className="px-4 py-2 rounded bg-cyan-600 text-white w-full sm:w-auto">متابعة لرؤية المحتوى (قد لا تعمل الفيديوهات)</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* المحتوى الرئيسي */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 p-6">
        <style>{`
          /* Custom scrollbar for lecture list */
          .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(139,142,150,0.6) transparent; }
          .custom-scrollbar::-webkit-scrollbar { width: 10px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(55,65,81,0.9), rgba(17,24,39,0.9));
            border-radius: 9999px; border: 2px solid rgba(255,255,255,0.03); box-shadow: inset 0 0 6px rgba(0,0,0,0.4);
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #6366f1, #06b6d4); }
          /* Scrollbar for lecture content area */
          .lecture-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(99,102,139,0.9) transparent; }
          .lecture-scrollbar::-webkit-scrollbar { width: 12px; }
          .lecture-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .lecture-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, rgba(99,102,241,0.95), rgba(6,182,212,0.95));
            border-radius: 9999px;
            border: 3px solid transparent;
            background-clip: padding-box;
            box-shadow: inset 0 0 8px rgba(0,0,0,0.35);
          }
          .lecture-scrollbar::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #7c3aed, #06b6d4); transform: scaleY(1.02); }
          .lecture-scrollbar::-webkit-scrollbar-thumb:active { transform: scaleY(1.05); }
        `}</style>
        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-8 p-4 border border-red-500/30 rounded-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-red-400"
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
              <div>
                <div className="text-white font-medium">حدث خطأ</div>
                <div className="text-white/70 text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* معلومات الفصل */}
        {chapter && (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 overflow-hidden">
              <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* عرض المادة بدلاً من صورة الفصل */}
                <div className="w-full">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-white/5 to-white/10 border border-white/8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        {/* breadcrumb / small metadata with links */}
                        <div className="text-xs text-white/50 mb-2">
                          {material?.title ? (
                            <Link
                              to={`/material/${material._id}`}
                              className="text-white/60 hover:underline"
                            >
                              {material.title}
                            </Link>
                          ) : (
                            <span className="text-white/60">المادة</span>
                          )}
                          <span className="mx-2">/</span>
                          {chapter?.instructorId?._id ? (
                            <Link
                              to={`/instructor/${chapter.instructorId._id}`}
                              className="text-white/60 hover:underline"
                            >
                              {chapter.instructorId.title}
                            </Link>
                          ) : (
                            <span className="text-white/60">المدرّس</span>
                          )}
                        </div>

                        {/* chapter title */}
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
                          {chapter.title}
                        </h1>

                        {/* compact stats under title */}
                        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/70">
                          <div className="flex items-center gap-2">
                            <PlayCircleIcon className="w-4 h-4 text-cyan-300" />
                            <span>{chapter.lectures?.length || 0} محاضرة</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AcademicCapIcon className="w-4 h-4 text-emerald-300" />
                            <span>{chapterTotalVideos() || 0} فيديو</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ClockIcon className="w-4 h-4 text-orange-300" />
                            <span>{formatTime(chapterTotalSeconds())}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* المحتوى الرئيسي */}

        {/* Inline video player (يظهر عند اختيار فيديو) */}
        {selectedVideo && (
          <div className="mb-6" ref={playerRef}>
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    تشغيل الفيديو
                  </h3>
                  <p className="text-sm text-white/60">{selectedVideo.title}</p>
                </div>
                <div>
                  <button
                    onClick={() => {
                      setSelectedVideo(null);
                      try {
                        navigate(
                          `/chapter/${chapterId}${selectedLectureId ? `/lecture/${selectedLectureId}` : ""}`,
                        );
                      } catch (e) {}
                    }}
                    className="px-3 py-1 bg-white/10 text-white rounded-lg hover:bg-white/20"
                  >
                    إغلاق المشغل
                  </button>
                </div>
              </div>
              <div>
                <VideoPlayer video={selectedVideo} />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {/* قائمة المحاضرات */}
          <div>
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">المحاضرات</h3>
                <div className="text-sm text-white/60">
                  {chapter?.lectures?.length || 0}
                </div>
              </div>

              <div className="pr-2">

                {!chapter?.lectures || chapter.lectures.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpenIcon className="w-12 h-12 text-white/30 mx-auto mb-3" />
                    <p className="text-white/60">لا توجد محاضرات بعد</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                    {sortedLectures.map((lecture, index) => {
                      const secs = lectureTotalSeconds(lecture);
                      const imgSrc =
                        lecture.thumbnailUrl ||
                        lecture.thumbnail ||
                        chapter.thumbnailUrl ||
                        "";
                      // compute broken videos count: prefer pre-fetched `lectureAvailability`,
                      // otherwise fall back to embedded lecture.videos when present
                      let brokenCount = 0;
                      let totalCount = 0;
                      const la = lectureAvailability && lectureAvailability[lecture._id];
                      if (la) {
                        brokenCount = la.broken || 0;
                        totalCount = la.total || 0;
                      } else if (Array.isArray(lecture.videos) && lecture.videos.length > 0) {
                        lecture.videos.forEach((v) => {
                          totalCount += 1;
                          const quals = Array.isArray(v.qualities) ? v.qualities : [];
                          const available = quals.some((q) => q && (q.lastSegmentUrl || q.url));
                          if (!available) brokenCount += 1;
                        });
                      }
                      return (
                        <button
                          id={`lecture-${lecture._id}`}
                          key={lecture._id}
                          onClick={async () => {
                            try {
                              // Prefer precomputed availability if present; otherwise fetch now and block navigation
                              let la = lectureAvailability && lectureAvailability[lecture._id];
                              if (!la) {
                                try {
                                  setAvailLoadingIds((s) => new Set([...s, lecture._id]));
                                  const fres = await videosAPI.getLectureAvailability(lecture._id);
                                  if (fres && fres.data && fres.data.ok) {
                                    setLectureAvailability((prev) => ({ ...(prev || {}), [lecture._id]: fres.data }));
                                    la = fres.data;
                                  }
                                } catch (e) {
                                  // ignore and fallback to embedded data
                                } finally {
                                  setAvailLoadingIds((s) => { const n = new Set(Array.from(s).filter(x => x !== lecture._id)); return n; });
                                }
                              }
                              if (la && la.allBroken) {
                                setUnavailableModal({ open: true, lecture, videos: [] });
                                return;
                              }
                              // ensure we have videos list to decide availability (fallback)
                              let vids = lecture.videos;
                              if (!Array.isArray(vids) || vids.length === 0) {
                                try {
                                  const res = await videosAPI.getVideosByLecture(lecture._id);
                                  vids = res.data || [];
                                } catch (fetchErr) {
                                  console.debug('[ChapterLecturesPage] failed fetching videos for', lecture._id, fetchErr);
                                  vids = [];
                                }
                              }
                              // compute availability fallback
                              const totals = vids.length;
                              const bad = vids.filter((v) => {
                                const quals = Array.isArray(v.qualities) ? v.qualities : [];
                                return !quals.some((q) => q && (q.lastSegmentUrl || q.url));
                              });
                              if (totals > 0 && bad.length === totals) {
                                // all videos broken: show modal before entering
                                setUnavailableModal({ open: true, lecture, videos: vids });
                                return;
                              }
                              setSelectedLectureId(lecture._id);
                              setSelectedVideo(null);
                              navigate(`/chapter/${chapterId}/lecture/${lecture._id}`);
                            } catch (e) {
                              console.debug('[ChapterLecturesPage] lecture click error', e);
                            }
                            if (
                              typeof window !== "undefined" &&
                              window.innerWidth &&
                              window.innerWidth < 768
                            ) {
                              setTimeout(() => {
                                const el =
                                  document.getElementById("lecture-content");
                                if (el)
                                  el.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                              }, 120);
                            }
                          }}
                          className={`w-full text-right rounded-2xl transition-all duration-300 overflow-hidden border ${
                            selectedLectureId === lecture._id
                              ? "bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/30"
                              : "bg-white/5 border-white/10 hover:border-white/20"
                          }`}
                          disabled={availLoadingIds.has(lecture._id)}
                        >
                          <div className="relative">
                            <div className="w-full h-40 bg-white/5">
                              {imgSrc ? (
                                <img
                                  src={imgSrc}
                                  alt={lecture.title}
                                  className="w-full h-40 object-cover"
                                />
                              ) : (
                                <div className="w-full h-40 flex items-center justify-center bg-white/5">
                                  {getLectureIcon(lecture)}
                                </div>
                              )}
                            </div>
                            <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
                              {index + 1}
                            </div>
                            {totalCount > 0 && brokenCount > 0 && (
                              <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                                {brokenCount} غير متاح
                              </div>
                            )}
                            {availLoadingIds.has(lecture._id) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                <ArrowPathIcon className="w-6 h-6 text-white animate-spin" />
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <div className="font-medium text-white line-clamp-2">
                              {lecture.title}
                            </div>
                            <div className="text-xs text-white/60 mt-2">
                              {secs > 0
                                ? `مدة الفيديوهات: ${formatTime(secs)}`
                                : ""}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-3 text-xs text-white/70">
                                <PlayCircleIcon className="w-4 h-4 text-cyan-300" />
                                <span>
                                  {(lecture.videos && lecture.videos.length) ||
                                    0}{" "}
                                  فيديو
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-white/70">
                                <DocumentTextIcon className="w-4 h-4 text-purple-300" />
                                <span>
                                  {(lecture.pdfs && lecture.pdfs.length) || 0}{" "}
                                  ملف
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {showDebugAvail && (
                <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded text-sm text-white/70">
                  <div className="font-medium mb-2">Debug: lectureAvailability</div>
                  <pre className="whitespace-pre-wrap text-xs max-h-64 overflow-auto">{JSON.stringify(lectureAvailability, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* فوتر */}
      <UserFooter />
    </div>
  );
};

export default ChapterLecturesPage;
