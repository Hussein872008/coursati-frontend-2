import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { chapterAPI, pdfsAPI, videosAPI, lecturesAPI } from '../../utils/api';
import UserHeader from '../../components/user/UserHeader';
import UserFooter from '../../components/user/UserFooter';
import VideoPlayer from '../../components/VideoPlayer';
import {
  BookOpenIcon,
  ClockIcon,
  PlayCircleIcon,
  DocumentTextIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import useTitle from '../../hooks/useTitle';

const API_BASE = import.meta.env.VITE_API_BASE;

const ChapterLecturesPage = () => {
  const navigate = useNavigate();
  const { chapterId } = useParams();
  const { user } = useAuth();
  const [chapter, setChapter] = useState(null);
  useTitle('كورساتي —  محتوي الفصل');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLectureId, setSelectedLectureId] = useState(null);
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
        try {
          const qp = new URLSearchParams(window.location.search);
          const l = qp.get('lecture');
          if (l) {
            setSelectedLectureId(l);
          } else if (response.data?.lectures && response.data.lectures.length > 0) {
            setSelectedLectureId(response.data.lectures[0]._id);
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

  // تحميل ملفات PDF للمحاضرة المختارة
  useEffect(() => {
    const loadPDFs = async () => {
      if (!selectedLectureId) return;
      try {
        setPdfsLoading(true);
        const lectureFromChapter = chapter?.lectures?.find((l) => l._id === selectedLectureId);
        if (lectureFromChapter && Array.isArray(lectureFromChapter.pdfs) && lectureFromChapter.pdfs.length > 0) {
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
        const lectureFromChapter = chapter?.lectures?.find((l) => l._id === selectedLectureId);
        if (lectureFromChapter && Array.isArray(lectureFromChapter.videos) && lectureFromChapter.videos.length > 0) {
          setVideos(lectureFromChapter.videos);
        } else {
          const res = await videosAPI.getVideosByLecture(selectedLectureId);
          console.debug('videosAPI.getVideosByLecture response for', selectedLectureId, res && res.data);
          const vids = res.data || [];
          setVideos(vids);

          try {
            const qp = new URLSearchParams(window.location.search);
            const v = qp.get('video');
            if (v) {
              const found = vids.find((x) => String(x._id) === String(v));
              if (found) {
                setSelectedVideo(found);
                try { await lecturesAPI.viewLecture(selectedLectureId); } catch (e) {}
                try { await videosAPI.viewVideo(found._id); } catch (e) {}
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
          playerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }, 80);
    }
  }, [selectedVideo]);

  // Scroll the selected lecture button into view when lecture changes
  useEffect(() => {
    if (!selectedLectureId) return;
    try {
      const el = document.getElementById(`lecture-${selectedLectureId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}
  }, [selectedLectureId]);

  // تسجيل عرض PDF
  const handlePDFView = useCallback(async (pdfId) => {
    try {
      const userCode = localStorage.getItem('userCode');
      const url = `${API_BASE}/api/pdfs/${pdfId}/view`;

      if (userCode) {
        fetch(url, {
          method: 'POST',
          headers: { 
            'user-code': userCode,
            'Content-Type': 'application/json'
          },
          keepalive: true,
          body: JSON.stringify({ timestamp: new Date().toISOString() })
        }).catch(() => {});
      } else if (navigator.sendBeacon) {
        const data = new Blob([JSON.stringify({
          anonymous: true,
          timestamp: new Date().toISOString()
        })], { type: 'application/json' });
        navigator.sendBeacon(url, data);
      } else {
        fetch(url, {
          method: 'POST',
          keepalive: true
        }).catch(() => {});
      }
    } catch (err) {
      // failed to record PDF view (handled by UI)
    }
  }, []);


  const getLectureIcon = (lecture) => {
    if (lecture.pdfs?.length > 0) return <DocumentTextIcon className="w-4 h-4 text-purple-400" />;
    return <BookOpenIcon className="w-4 h-4 text-emerald-400" />;
  };

  // format seconds to H:MM:SS or M:SS
  const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds)) return '0:00';
    const sec = Math.floor(seconds);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                {/* صورة الفصل */}
                <div className="md:w-1/3 flex-shrink-0">
                  <div className="relative group overflow-hidden rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 rounded-xl blur-lg opacity-0" />
                    {chapter.thumbnailUrl ? (
                      <img
                        src={chapter.thumbnailUrl}
                        alt={chapter.title}
                        className="w-full h-32 sm:h-40 md:h-56 object-cover rounded-xl object-top"
                      />
                    ) : (
                      <div className="w-full h-32 sm:h-40 md:h-56 bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center rounded-xl">
                        <BookOpenIcon className="w-12 h-12 sm:w-16 sm:h-16 text-white/30" />
                      </div>
                    )}
                  </div>
                </div>

                {/* معلومات الفصل */}
                <div className="md:w-2/3">
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{chapter.title}</h1>
                  {chapter.instructorId && (
                    <div className="text-sm text-white/60 mb-4">
                          <span className="font-medium text-white">{chapter.instructorId.title || 'المدرس'}</span>
                        </div>
                  )}
                </div>
              </div>

              {/* إحصائيات الفصل */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2 sm:p-3 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <div className="p-1 sm:p-2 bg-cyan-500/20 rounded-lg">
                      <PlayCircleIcon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs text-white/60">المحاضرات</div>
                      <div className="text-lg sm:text-xl font-bold text-cyan-300">{chapter.lectures?.length || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <div className="p-1 sm:p-2 bg-purple-500/20 rounded-lg">
                      <DocumentTextIcon className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <div className="text-xs text-white/60">ملفات PDF</div>
                      <div className="text-lg sm:text-xl font-bold text-purple-300">{chapter.lectures?.reduce((sum, l) => sum + (l.pdfs?.length || 0), 0) || 0}</div>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 p-2 sm:p-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/20">
                  <div className="text-xs text-white/60">إجمالي مدة الفيديوهات</div>
                  <div className="text-lg sm:text-xl font-bold text-orange-300">{formatTime(chapterTotalSeconds())}</div>
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
                  <h3 className="text-lg font-semibold text-white">تشغيل الفيديو</h3>
                  <p className="text-sm text-white/60">{selectedVideo.title}</p>
                </div>
                <div>
                  <button
                    onClick={() => {
                      setSelectedVideo(null);
                      try {
                        const qp = new URLSearchParams(window.location.search);
                        qp.delete('video');
                        const qs = qp.toString();
                        window.history.pushState(null, '', `/chapter/${chapterId}${qs ? `?${qs}` : ''}`);
                      } catch (e) {}
                    }}
                    className="px-3 py-1 bg-white/10 text-white rounded-lg hover:bg-white/20"
                  >إغلاق المشغل</button>
                </div>
              </div>
              <div>
                <VideoPlayer video={selectedVideo} />
              </div>
            </div>
          </div>
        )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* قائمة المحاضرات */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 h-auto lg:h-[calc(100vh-300px)] overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">المحاضرات</h3>
                <div className="text-sm text-white/60">
                  {chapter?.lectures?.length || 0}
                </div>
              </div>

              <div className="h-auto lg:h-[calc(100%-60px)] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {chapter?.lectures?.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpenIcon className="w-12 h-12 text-white/30 mx-auto mb-3" />
                    <p className="text-white/60">لا توجد محاضرات بعد</p>
                  </div>
                ) : (
                  chapter?.lectures?.map((lecture, index) => (
                    <button
                      id={`lecture-${lecture._id}`}
                      key={lecture._id}
                      onClick={() => {
                        setSelectedLectureId(lecture._id);
                        setSelectedVideo(null);
                            try {
                            const qp = new URLSearchParams(window.location.search);
                            qp.set('lecture', lecture._id);
                            qp.delete('video');
                            const qs = qp.toString();
                            window.history.pushState(null, '', `/chapter/${chapterId}${qs ? `?${qs}` : ''}`);
                          } catch (e) {}

                          // on small screens, scroll the lecture content into view
                          if (typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 768) {
                            setTimeout(() => {
                              const el = document.getElementById('lecture-content');
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 120);
                          }
                      }}
                      className={`w-full text-right p-3 md:p-4 rounded-xl transition-all duration-300 border ${
                        selectedLectureId === lecture._id
                          ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-500/30'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 text-sm font-bold text-white/40 w-6 text-center">
                          {index + 1}
                        </div>
                        <div className="flex-shrink-0">
                          {lecture.thumbnailUrl || lecture.thumbnail ? (
                            <img src={lecture.thumbnailUrl || lecture.thumbnail} alt={lecture.title} className="w-14 h-10 sm:w-16 sm:h-10 object-cover rounded-md" />
                          ) : (
                            <div className="w-14 h-10 sm:w-16 sm:h-10 bg-white/5 rounded-md flex items-center justify-center">
                              {getLectureIcon(lecture)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white whitespace-normal break-words">{lecture.title}</div>
                          <div className="text-xs text-white/60 mt-1">{
                            // show total duration of videos inside this lecture
                            (() => {
                              const secs = lectureTotalSeconds(lecture);
                              return secs > 0 ? `مدة الفيديوهات: ${formatTime(secs)}` : '';
                            })()
                          }</div>

                        </div>
                        {selectedLectureId === lecture._id && (
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* محتوى المحاضرة */}
          <div className="lg:col-span-2">
            <div id="lecture-content" className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden h-auto lg:h-[calc(100vh-300px)] flex flex-col">
              {selectedLectureId ? (
                <>
                  {/* رأس المحاضرة */}
                  <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 border-b border-white/10 px-6 py-4">
                    <h2 className="text-xl font-bold text-white">
                      {chapter?.lectures?.find(l => l._id === selectedLectureId)?.title}
                    </h2>
                    <p className="text-sm text-white/60 mt-1">ملفات ومحتوى المحاضرة</p>
                  </div>

                  {/* محتوى المحاضرة */}
                  <div className="flex-1 overflow-y-auto lecture-scrollbar" dir="rtl">
                    <div className="p-6 space-y-6">
                      {/* حالات العرض */}
                      {pdfsLoading ? (
                        <div className="flex flex-col items-center justify-center py-16">
                          <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 border-r-purple-400 animate-spin"></div>
                          </div>
                          <p className="text-white/70 font-medium">جاري تحميل الملفات...</p>
                          <p className="text-white/40 text-sm mt-2">يرجى الانتظار</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Videos section - always shown regardless of PDFs */}
                          {videosLoading ? (
                            <div className="text-white/70">جاري تحميل الفيديوهات...</div>
                          ) : videos.length === 0 ? (
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-white/70">
                              لا توجد فيديوهات لهذه المحاضرة.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <h4 className="text-lg font-semibold text-white">فيديوهات المحاضرة</h4>
                              {videos.map((v, idx) => (
                                <button
                                  key={v._id}
                                  onClick={() => {
                                        setSelectedVideo(v);
                                        // record lecture view and specific video view when user starts a video
                                        (async () => {
                                          try { await lecturesAPI.viewLecture(selectedLectureId); } catch (e) {}
                                          try { await videosAPI.viewVideo(v._id); } catch (e) {}
                                        })();
                                    try {
                                      const qp = new URLSearchParams(window.location.search);
                                      qp.set('lecture', selectedLectureId || chapter?.lectures?.[0]?._id || '');
                                      qp.set('video', v._id);
                                      const qs = qp.toString();
                                      window.history.pushState(null, '', `/chapter/${chapterId}${qs ? `?${qs}` : ''}`);
                                    } catch (e) {}
                                  }}
                                  className={`group block w-full text-right p-4 rounded-xl transition-all duration-300 border hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-blue-500/20 ${selectedVideo && String(selectedVideo._id) === String(v._id) ? 'bg-gradient-to-r from-green-600/10 to-green-400/5 border-green-400/30 ring-1 ring-green-400' : 'bg-gradient-to-r from-gray-700/30 to-gray-800/30 border-white/10 hover:border-cyan-500/50'}`}
                                  aria-current={selectedVideo && String(selectedVideo._id) === String(v._id) ? 'true' : undefined}
                                >
                                  <div className="flex items-center gap-4 h-auto sm:h-14">
                                    <div className="flex-shrink-0 w-12 h-12 bg-cyan-600/20 border border-cyan-600/30 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                                      <PlayCircleIcon className="w-6 h-6 text-cyan-300" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <h4 className={`font-semibold whitespace-normal break-words ${selectedVideo && String(selectedVideo._id) === String(v._id) ? 'text-green-300' : 'text-white group-hover:text-cyan-300'} transition-colors`}>
                                            {idx + 1}. {v.title}
                                          </h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="mt-2 sm:mt-0 px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded font-medium flex-shrink-0">فيديو</span>
                                          {selectedVideo && String(selectedVideo._id) === String(v._id) && (
                                            <span className="mt-2 sm:mt-0 px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded font-semibold flex-shrink-0">مشغّل</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className={`p-2 rounded-lg ${selectedVideo && String(selectedVideo._id) === String(v._id) ? 'bg-green-500/10' : 'bg-cyan-500/10'}`}>
                                        <svg className="w-5 h-5 text-cyan-300" viewBox="0 0 24 24" fill="currentColor">
                                          <path d="M8 5v14l11-7z" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* PDFs section (independent) */}
                          {pdfs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6 border border-blue-500/30">
                                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className="text-white/80 font-semibold text-lg">لا توجد ملفات PDF</p>
                              <p className="text-white/50 text-sm mt-2">ستتم إضافة الملفات قريباً لهذه المحاضرة</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {pdfs.map((pdf, index) => (
                                <a
                                  key={pdf._id}
                                  href={pdf.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group block p-3 sm:p-4 bg-gradient-to-r from-gray-700/30 to-gray-800/30 border border-white/10 hover:border-blue-500/50 rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-purple-500/20"
                                  onClick={() => handlePDFView(pdf._id)}
                                >
                                    <div className="flex items-center gap-4 h-auto sm:h-14">
                                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-red-500/30 to-red-600/30 border border-red-500/50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                      </svg>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-semibold text-white group-hover:text-blue-300 transition-colors whitespace-normal break-words">
                                            {index + 1}. {pdf.title}
                                          </h4>
                                        </div>
                                        <span className="mt-2 sm:mt-0 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded font-medium flex-shrink-0">
                                          PDF
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </div>
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-6 border border-purple-500/30 animate-pulse">
                    <BookOpenIcon className="w-12 h-12 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">مرحباً بك 👋</h3>
                  <p className="text-white/70 mb-8 max-w-md">
                    اختر محاضرة من القائمة الجانبية لعرض ملفات PDF والمحتوى الخاص بها
                  </p>
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
