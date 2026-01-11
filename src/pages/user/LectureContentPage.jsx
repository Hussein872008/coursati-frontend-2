import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api, {
  chapterAPI,
  pdfsAPI,
  videosAPI,
  lecturesAPI,
  materialAPI,
  instructorAPI,
  adminAPI,
} from "../../utils/api";
import { toast } from 'react-toastify';
import UserHeader from "../../components/user/UserHeader";
import UserFooter from "../../components/user/UserFooter";
import VideoPlayer from "../../components/VideoPlayer";
import {
  BookOpenIcon,
  PlayCircleIcon,
  DocumentTextIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import useTitle from "../../hooks/useTitle";

function formatDuration(totalSeconds) {
  const sec = Number.isFinite(totalSeconds) ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hours}:${mm}:${ss}`;
}

const LectureContentPage = () => {
  const { chapterId, lectureId } = useParams();

  const { user } = useAuth();
  const [chapter, setChapter] = useState(null);
  const [material, setMaterial] = useState(null);
  const [instructor, setInstructor] = useState(null);
  // validation removed: no-op in UI
  const [lecture, setLecture] = useState(null);
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [pdfs, setPdfs] = useState([]);
  const [pdfsLoading, setPdfsLoading] = useState(false);
  const [pdfOpenedMap, setPdfOpenedMap] = useState({});
  const [selectedVideo, setSelectedVideo] = useState(null);
  const playerRef = useRef(null);
  const downloadStartTimesRef = useRef({}); // Track start time for each download
  const [videoProgressMap, setVideoProgressMap] = useState({});
  const [downloadingVideoId, setDownloadingVideoId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadMenuOpenVideoId, setDownloadMenuOpenVideoId] = useState(null);
  const [downloadDataMap, setDownloadDataMap] = useState({}); // Track download data per video
  const [showDownloadPermissionModal, setShowDownloadPermissionModal] = useState(false);

  const totalDuration = useMemo(() => {
    return videos.reduce((sum, v) => sum + (Number(v.duration) || 0), 0);
  }, [videos]);

  const breadcrumbMaterialId =
    material?._id ||
    chapter?.materialId ||
    chapter?.material?._id ||
    (chapter?.instructorId && typeof chapter.instructorId === "object"
      ? chapter.instructorId.materialId
      : chapter?.instructorId && chapter.instructorId?.materialId);

  const breadcrumbInstructorId =
    instructor?._id ||
    (chapter?.instructorId &&
      (typeof chapter.instructorId === "string"
        ? chapter.instructorId
        : chapter?.instructorId && chapter.instructorId?._id));

  useTitle("كورساتي — محتوى المحاضرة");

  const handleDownloadVideo = async (video, quality) => {
    try {
      if (!(user?.isAdmin || user?.canDownloadVideos)) {
        // عرض modal بتصميم احسن
        setShowDownloadPermissionModal(true);
        return;
      }

      if (!quality) {
        alert("لم يتم تحديد جودة للتحميل");
        return;
      }

      setDownloadingVideoId(video._id);
      setDownloadProgress(0);
      setDownloadMenuOpenVideoId(null);

      // Store start time in ref
      downloadStartTimesRef.current[video._id] = Date.now();

      const userCode = localStorage.getItem("userCode");
      const downloadUrl = `/api/videos/${video._id}/download?quality=${encodeURIComponent(quality)}${userCode ? `&userCode=${encodeURIComponent(userCode)}` : ""}`;
      
      const res = await api.get(downloadUrl, {
        responseType: "blob",
        onDownloadProgress: (ev) => {
          try {
            const loaded = ev.loaded || 0;
            const total = ev.total || 0;
            
            if (total > 0) {
              const pct = Math.round((loaded / total) * 100);
              setDownloadProgress(pct);

              // Calculate elapsed time and estimated remaining time
              const now = Date.now();
              const startTime = downloadStartTimesRef.current[video._id];
              const elapsedMs = now - startTime;
              const elapsedSeconds = elapsedMs / 1000;

              if (elapsedSeconds > 0.5) {
                // Only calculate after 0.5 seconds to avoid zero division
                const bytesPerSecond = loaded / elapsedSeconds;
                const remainingBytes = total - loaded;
                const estimatedSeconds = Math.ceil(remainingBytes / bytesPerSecond);

                setDownloadDataMap((prev) => ({
                  ...prev,
                  [video._id]: {
                    startTime,
                    estimatedTime: Math.max(0, estimatedSeconds),
                    speed: bytesPerSecond,
                    loaded,
                    total,
                  },
                }));
              }
            }
          } catch (e) {
            console.error("Progress error:", e);
          }
        },
      });

      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const cd = res.headers["content-disposition"] || "";
      let filename = `${video?.title ? video.title.replace(/[^a-z0-9\-_. ]/gi, "_") : "video"}_${quality}p.ts`;
      const m = cd.match(/filename\*=UTF-8''([^;\n\r]+)/);
      if (m && m[1]) filename = decodeURIComponent(m[1]);
      else {
        const m2 = cd.match(/filename="?([^";]+)"?/);
        if (m2 && m2[1]) filename = m2[1];
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error("Download error:", err);
      alert("فشل التحميل. حاول مرة أخرى.");
    } finally {
      setDownloadingVideoId(null);
      setDownloadProgress(null);
      setDownloadDataMap((prev) => {
        const newMap = { ...prev };
        delete newMap[video._id];
        return newMap;
      });
      delete downloadStartTimesRef.current[video._id];
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await chapterAPI.getChapterById(chapterId);
        setChapter(res.data);
        const found = res.data?.lectures?.find(
          (l) => String(l._id) === String(lectureId),
        );
        setLecture(found || null);

        // fetch instructor (may be populated or an id)
        let fetchedInstructor = null;
        try {
          if (res.data?.instructor && res.data.instructor.name) {
            fetchedInstructor = res.data.instructor;
          } else if (res.data?.instructorId) {
            // instructorId might be populated object or an id string
            if (typeof res.data.instructorId === "string") {
              const ires = await instructorAPI.getInstructorById(
                res.data.instructorId,
              );
              fetchedInstructor = ires.data || null;
            } else if (typeof res.data.instructorId === "object") {
              fetchedInstructor = res.data.instructorId;
            }
          }
        } catch (err) {
          fetchedInstructor = null;
        }
        setInstructor(fetchedInstructor);

        // fetch material: prefer embedded material, then chapter.materialId, then instructor.materialId
        try {
          if (res.data?.material && res.data.material.title) {
            setMaterial(res.data.material);
          } else {
            const matIdFromChapter = res.data?.materialId;
            const matIdFromInstructor =
              fetchedInstructor?.materialId ||
              (fetchedInstructor?.material && fetchedInstructor.material._id);
            const matId = matIdFromChapter || matIdFromInstructor;
            if (matId) {
              const mres = await materialAPI.getMaterialById(matId);
              setMaterial(mres.data || null);
            } else {
              setMaterial(null);
            }
          }
        } catch (err) {
          setMaterial(null);
        }
      } catch (e) {
        setChapter(null);
        setLecture(null);
      }
    };
    if (chapterId && lectureId) load();
  }, [chapterId, lectureId]);

  useEffect(() => {
    const loadVideos = async () => {
      if (!lectureId) return;
      try {
        setVideosLoading(true);
        const res = await videosAPI.getVideosByLecture(lectureId);
        const list = res.data || [];
        // normalize availability flag for each video
        const enhanced = (list || []).map((v) => {
          if (!v) return v;
          const quals = Array.isArray(v.qualities) ? v.qualities : [];
          const available = quals.some((q) => q && (q.lastSegmentUrl || q.url));
          return { ...v, _available: !!available };
        });
        setVideos(enhanced);
        // Fetch authoritative availability from server and merge per-video availability when available
        (async () => {
          try {
            const avRes = await videosAPI.getLectureAvailability(lectureId);
            const av = avRes && avRes.data;
            if (av && av.perVideo) {
              const map = {};
              try {
                if (Array.isArray(av.perVideo)) {
                  av.perVideo.forEach((p) => {
                    try { map[String(p.videoId)] = !!p.available; } catch (e) {}
                  });
                } else if (typeof av.perVideo === 'object') {
                  // backend currently returns a map of videoId -> status string
                  Object.entries(av.perVideo).forEach(([k, v]) => {
                    try { map[String(k)] = (String(v) === 'working'); } catch (e) {}
                  });
                }
              } catch (e) {}
              // Override local flags with authoritative DB-derived availability
              setVideos((prev) =>
                (prev || []).map((v) => {
                  try {
                    const key = String(v._id);
                    if (typeof map[key] === 'boolean') return { ...v, _available: map[key] };
                  } catch (e) {}
                  return v;
                })
              );
            }
          } catch (e) {
            // ignore availability fetch errors; keep optimistic local flags
          }
        })();
        // load saved progress from localStorage for each video
        try {
          const map = {};
          list.forEach((v) => {
            try {
              const raw = localStorage.getItem(`video-progress-${v._id}`);
              if (raw) {
                const obj = JSON.parse(raw);
                const pct = obj.duration
                  ? Math.min(
                      100,
                      Math.round((obj.currentTime / obj.duration) * 100),
                    )
                  : 0;
                map[v._id] = {
                  currentTime: obj.currentTime || 0,
                  duration: obj.duration || v.duration || 0,
                  pct,
                };
              }
            } catch (e) {}
          });
          setVideoProgressMap(map);
        } catch (e) {}
      } catch (e) {
        setVideos([]);
      } finally {
        setVideosLoading(false);
      }
    };
    loadVideos();
  }, [lectureId]);

  // no-op here; click handler below will mark opened and call API

  // attach timeupdate listener to inner video element to persist progress
  useEffect(() => {
    let el = null;
    let onTimeUpdate = null;
    try {
      if (selectedVideo && playerRef.current) {
        // find first video element inside player container
        el = playerRef.current.querySelector("video");
        if (el) {
          onTimeUpdate = () => {
            try {
              const ct = el.currentTime || 0;
              const dur = el.duration || selectedVideo.duration || 0;
              const payload = {
                currentTime: ct,
                duration: dur,
                updatedAt: new Date().toISOString(),
              };
              localStorage.setItem(
                `video-progress-${selectedVideo._id}`,
                JSON.stringify(payload),
              );
              setVideoProgressMap((prev) => ({
                ...prev,
                [selectedVideo._id]: {
                  currentTime: ct,
                  duration: dur,
                  pct: dur ? Math.min(100, Math.round((ct / dur) * 100)) : 0,
                },
              }));
            } catch (e) {}
          };
          el.addEventListener("timeupdate", onTimeUpdate);
        }
      }
    } catch (e) {}
    return () => {
      try {
        if (el && onTimeUpdate)
          el.removeEventListener("timeupdate", onTimeUpdate);
      } catch (e) {}
    };
  }, [selectedVideo]);

  useEffect(() => {
    const loadPdfs = async () => {
      if (!lectureId) return;
      try {
        setPdfsLoading(true);
        const res = await pdfsAPI.getPDFsByLecture(lectureId);
        const list = res.data || [];
        setPdfs(list);
        // load opened state from localStorage
        try {
          const map = {};
          list.forEach((p) => {
            try {
              const raw = localStorage.getItem(`pdf-opened-${p._id}`);
              if (raw) map[p._id] = true;
            } catch (e) {}
          });
          setPdfOpenedMap(map);
        } catch (e) {}
      } catch (e) {
        setPdfs([]);
      } finally {
        setPdfsLoading(false);
      }
    };
    loadPdfs();
  }, [lectureId]);

  return (
    <div className="min-h-screen" dir="rtl">
      <UserHeader showBackButton={false} />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 p-6">
        <div className="mb-6">
          <div className="mb-2 text-sm text-white/60">
            <nav className="flex items-center gap-2">
              {breadcrumbMaterialId && (
                <Link
                  to={`/material/${breadcrumbMaterialId}`}
                  className="hover:underline"
                >
                  {material?.title || chapter?.material?.title || "المادة"}
                </Link>
              )}
              {breadcrumbInstructorId && (
                <>
                  <span className="text-white/40">/</span>
                  <Link
                    to={`/instructor/${breadcrumbInstructorId}`}
                    className="hover:underline"
                  >
                    {instructor?.title ||
                      chapter?.instructor?.title ||
                      "المدرّس"}
                  </Link>
                </>
              )}
              <span className="text-white/40">/</span>
              <Link
                to={`/chapter/${chapterId}`}
                className="text-white/80 hover:underline"
              >
                {chapter?.title || "الشابتر"}
              </Link>
            </nav>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {lecture?.title || "محتوى المحاضرة"}
              </h1>
              <p className="text-sm text-white/60">محتوى المحاضرة والملفات</p>
              <div className="mt-3 flex items-center gap-4 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <PlayCircleIcon className="w-4 h-4 text-cyan-300" />
                  <span>{videos.length} فيديو</span>
                  <span className="mx-2">•</span>
                  <span>{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4 text-amber-300" />
                  <span>{pdfs.length} ملف PDF</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpenIcon className="w-4 h-4 text-indigo-300" />
                  <span>{chapter?.title || "الشابتر"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/* Full-width player strip (spans entire viewport) */}
      {selectedVideo && (
        <div
          ref={playerRef}
          className="w-full bg-gray-900 border-b border-white/10"
        >
          <div className="w-full">
            <VideoPlayer video={selectedVideo} />
          </div>
        </div>
      )}
        <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="space-y-6">
            <div className={`md:grid ${ (pdfsLoading || (pdfs && pdfs.length > 0)) ? 'md:grid-cols-2' : 'md:grid-cols-1'} md:gap-6 space-y-6 md:space-y-0`}>
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  فيديوهات المحاضرة
                </h3>
                {videosLoading ? (
                  <div className="text-white/70">جاري تحميل الفيديوهات...</div>
                ) : videos.length === 0 ? (
                  <div className="text-white/70">
                    لا توجد فيديوهات لهذه المحاضرة
                  </div>
                ) : (
                  <div className="space-y-2">
                    {videos.map((v, idx) => {
                      const isSelected =
                        selectedVideo && selectedVideo._id === v._id;
                      const isAvailable = v._available !== false;
                      const prog = videoProgressMap[v._id];
                      return (
                        <div key={v._id} className="relative">
                          <div
                            onClick={() => {
                              setSelectedVideo(v);
                              // mark as opened immediately and store initial progress
                              try {
                                const initial = {
                                  currentTime: 0,
                                  duration: v.duration || 0,
                                  updatedAt: new Date().toISOString(),
                                };
                                localStorage.setItem(
                                  `video-progress-${v._id}`,
                                  JSON.stringify(initial),
                                );
                                setVideoProgressMap((prev) => ({
                                  ...prev,
                                  [v._id]: {
                                    currentTime: 0,
                                    duration: initial.duration,
                                    pct: 0,
                                  },
                                }));
                              } catch (e) {}
                              // scroll to player
                              setTimeout(() => {
                                try {
                                  if (playerRef.current)
                                    playerRef.current.scrollIntoView({
                                      behavior: "smooth",
                                      block: "center",
                                    });
                                } catch (e) {}
                              }, 50);
                              (async () => {
                                try {
                                  await lecturesAPI.viewLecture(lectureId);
                                } catch (e) {}
                                try {
                                  await videosAPI.viewVideo(v._id);
                                } catch (e) {}
                              })();
                            }}
                            className={
                              "w-full text-right p-3 rounded-xl border cursor-pointer " +
                              (isSelected
                                ? "bg-cyan-800/40 border-cyan-500"
                                : isAvailable
                                ? "bg-white/5 border-white/10"
                                : "bg-gray-700/30 border-white/10") +
                              " hover:border-white/20"
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={
                                    "w-10 h-10 rounded-md flex items-center justify-center " +
                                    (isSelected
                                      ? "bg-cyan-600/40"
                                      : "bg-cyan-600/20")
                                  }
                                >
                                  {isAvailable ? (
                                    <PlayCircleIcon className="w-5 h-5 text-cyan-300" />
                                  ) : (
                                    <XCircleIcon className="w-5 h-5 text-red-400" />
                                  )}
                                </div>
                                <div className="text-white font-medium">
                                  {idx + 1}. {v.title}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-white/60 text-sm">
                                  {v.duration ? formatDuration(v.duration) : ""}
                                </div>
                                <div className="relative flex items-center gap-2">
                                  {/* Download button - يظهر دائماً */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (downloadingVideoId === v._id) return;
                                      
                                      // إذا لم يكن المستخدم مسموح له بالتحميل، اعرض modal
                                      if (!(user?.isAdmin || user?.canDownloadVideos)) {
                                        setShowDownloadPermissionModal(true);
                                        return;
                                      }
                                      
                                      setDownloadMenuOpenVideoId(
                                        downloadMenuOpenVideoId === v._id ? null : v._id
                                      );
                                    }}
                                    disabled={downloadingVideoId === v._id}
                                    className="p-2 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50 relative"
                                    title="تحميل الفيديو"
                                  >
                                    <ArrowDownTrayIcon className="w-5 h-5 text-amber-400" />
                                  </button>

                                  {/* Progress percentage - shown next to icon when downloading */}
                                  {downloadingVideoId === v._id && (
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 animate-in fade-in duration-200">
                                      <div className="w-3 h-3 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
                                      <span className="text-xs font-semibold text-amber-400 min-w-[30px]">
                                        {downloadProgress || 0}%
                                      </span>
                                      {downloadDataMap[v._id]?.estimatedTime && downloadDataMap[v._id].estimatedTime > 0 && (
                                        <>
                                          <span className="text-amber-400/50 text-xs">•</span>
                                          <span className="text-xs text-amber-300">
                                            {downloadDataMap[v._id].estimatedTime}ث
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {/* Download quality menu - يظهر فقط للمسموح لهم */}
                                  {downloadMenuOpenVideoId === v._id && downloadingVideoId !== v._id && (user?.isAdmin || user?.canDownloadVideos) && (
                                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 border border-amber-500/40 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 z-50 min-w-max">
                                      <div className="p-2 space-y-1">
                                        {v?.qualities && v.qualities.length > 0 ? (
                                          v.qualities.map((q) => (
                                            <button
                                              key={q._id || q.quality}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadVideo(v, q.quality);
                                              }}
                                                className="w-full text-right px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/20 rounded transition-colors"
                                              >
                                                {q.quality}p
                                              </button>
                                            ))
                                          ) : (
                                            <div className="px-3 py-2 text-xs text-white/60">
                                              لا توجد جودات متاحة
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                              {!isAvailable && (
                                <div className="mt-2 text-sm text-red-400 flex items-start gap-2">
                                  <XCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                  <span>هذا الفيديو غير متاح حالياً. يرجى محاولة لاحقاً.</span>
                                </div>
                              )}
                          </div>
                          {prog && (
                            <div className="mt-2 px-1">
                              <div className="h-2 bg-white/10 rounded overflow-hidden">
                                <div
                                  className="h-2 bg-cyan-500"
                                  style={{ width: (prog.pct || 0) + "%" }}
                                />
                              </div>
                              <div className="text-xs text-white/60 mt-1">
                                {prog.pct}% — تم فتح الفيديو
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">
                  ملفات PDF
                </h3>
                {pdfsLoading ? (
                  <div className="text-white/70">جاري تحميل الملفات...</div>
                ) : pdfs.length === 0 ? (
                  <div className="text-white/70">لا توجد ملفات PDF</div>
                ) : (
                  <div className="space-y-2">
                    {pdfs.map((pdf, idx) => {
                      const opened = !!pdfOpenedMap[pdf._id];
                      return (
                        <a
                          key={pdf._id}
                          href={pdf.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => {
                            try {
                              localStorage.setItem(
                                `pdf-opened-${pdf._id}`,
                                "1",
                              );
                              setPdfOpenedMap((prev) => ({
                                ...prev,
                                [pdf._id]: true,
                              }));
                            } catch (e) {}
                            (async () => {
                              try {
                                await pdfsAPI.viewPdf(pdf._id);
                              } catch (e) {}
                            })();
                          }}
                          className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <DocumentTextIcon className="w-5 h-5 text-amber-300" />
                              <div className="text-white">
                                {idx + 1}. {pdf.title}
                              </div>
                            </div>
                            {opened && (
                              <div className="text-xs text-emerald-300">
                                تم الفتح
                              </div>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Download Permission Modal */}
      {showDownloadPermissionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-300">
            {/* Header with icon */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13 10a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zM3 12a9 9 0 1118 0 9 9 0 01-18 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">صلاحية محدودة</h3>
                  <p className="text-sm text-white/60 mt-1">لا يمكنك تحميل هذا الفيديو</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-white/80 text-sm leading-relaxed mb-4">
                للأسف، فقط المشرفين والمستخدمين المسموح لهم يمكنهم تحميل الفيديوهات.
              </p>
            </div>

            {/* Footer with buttons */}
            <div className="p-4 border-t border-white/10 flex items-center gap-3">
              <button
                onClick={() => setShowDownloadPermissionModal(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors font-medium text-sm"
              >
                فهمت
              </button>
            </div>
          </div>
        </div>
      )}

      <UserFooter />
    </div>
  );
};

export default LectureContentPage;
