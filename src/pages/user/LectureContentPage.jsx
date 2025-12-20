import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  chapterAPI,
  pdfsAPI,
  videosAPI,
  lecturesAPI,
  materialAPI,
  instructorAPI,
} from "../../utils/api";
import UserHeader from "../../components/user/UserHeader";
import UserFooter from "../../components/user/UserFooter";
import VideoPlayer from "../../components/VideoPlayer";
import {
  BookOpenIcon,
  PlayCircleIcon,
  DocumentTextIcon,
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
  const [lecture, setLecture] = useState(null);
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [pdfs, setPdfs] = useState([]);
  const [pdfsLoading, setPdfsLoading] = useState(false);
  const [pdfOpenedMap, setPdfOpenedMap] = useState({});
  const [selectedVideo, setSelectedVideo] = useState(null);
  const playerRef = useRef(null);
  const [videoProgressMap, setVideoProgressMap] = useState({});

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
        : chapter.instructorId?._id)) ||
    chapter?.instructor?._id;

  useTitle("كورساتي — محتوى المحاضرة");

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
        setVideos(list);
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
            <div className="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
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
                      const prog = videoProgressMap[v._id];
                      return (
                        <div key={v._id} className="relative">
                          <button
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
                              "w-full text-right p-3 rounded-xl border " +
                              (isSelected
                                ? "bg-cyan-800/40 border-cyan-500"
                                : "bg-white/5 border-white/10") +
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
                                  <PlayCircleIcon className="w-5 h-5 text-cyan-300" />
                                </div>
                                <div className="text-white font-medium">
                                  {idx + 1}. {v.title}
                                </div>
                              </div>
                              <div className="text-white/60 text-sm">
                                {v.duration ? formatDuration(v.duration) : ""}
                              </div>
                            </div>
                          </button>
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
      <UserFooter />
    </div>
  );
};

export default LectureContentPage;
