import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api.js';

// Dark mode status badges
const STATUS_BADGES = {
  working: {
    label: 'شغال',
    color: 'text-emerald-400 bg-emerald-900/30 border border-emerald-700/50',
    dot: '🟢',
    bgColor: 'bg-emerald-900/20',
    icon: '✓',
    gradient: 'from-emerald-500 to-emerald-600',
    ringColor: 'ring-emerald-500/20',
  },
  broken: {
    label: 'معطل',
    color: 'text-rose-400 bg-rose-900/30 border border-rose-700/50',
    dot: '🔴',
    bgColor: 'bg-rose-900/20',
    icon: '✗',
    gradient: 'from-rose-500 to-rose-600',
    ringColor: 'ring-rose-500/20',
  },
  checking: {
    label: 'جاري الفحص',
    color: 'text-amber-400 bg-amber-900/30 border border-amber-700/50',
    dot: '🟡',
    bgColor: 'bg-amber-900/20',
    icon: '⏳',
    gradient: 'from-amber-500 to-amber-600',
    ringColor: 'ring-amber-500/20',
  },
  unknown: {
    label: 'غير معروف',
    color: 'text-gray-400 bg-gray-800/30 border border-gray-700/50',
    dot: '⚪',
    bgColor: 'bg-gray-800/20',
    icon: '?',
    gradient: 'from-gray-500 to-gray-600',
    ringColor: 'ring-gray-500/20',
  },
};

// Animation Components
const PulseAnimation = () => (
  <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
);

const ShimmerEffect = () => (
  <div className="animate-shimmer absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
);

// Loading Skeleton
const VideoRowSkeleton = () => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 animate-pulse">
    <div className="flex-1 flex items-center space-x-4">
      <div className="h-10 w-10 bg-gray-800 rounded-lg"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-800 rounded w-1/2"></div>
      </div>
    </div>
    <div className="h-8 bg-gray-800 rounded w-24"></div>
  </div>
);

function VideoRow({ video, onRecheck, lectureTitle, selected, onSelect, onOpenModal }) {
  const badge = STATUS_BADGES[video.status] || STATUS_BADGES.unknown;
  const [isRechecking, setIsRechecking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const handleRecheck = async (e) => {
    e.stopPropagation();
    setIsRechecking(true);
    await onRecheck(video);
    setTimeout(() => setIsRechecking(false), 2000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'غير متاح';
    return new Date(dateString).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };
  
  const duration = video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '--:--';
  
  return (
    <div 
      className={`relative flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800/30 transition-all duration-300 cursor-pointer group ${
        selected ? 'bg-blue-900/20 border-l-4 border-blue-500' : ''
      } ${isHovered ? 'transform scale-[1.002] shadow-lg' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onOpenModal && onOpenModal(video)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenModal && onOpenModal(video)}
      aria-label={`تفاصيل الفيديو ${video.title}`}
    >
      {isHovered && <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>}
      
      {/* Selection checkbox */}
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(video._id || video.id);
          }}
          className="h-4 w-4 text-blue-500 rounded border-gray-700 bg-gray-900 focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`تحديد الفيديو ${video.title}`}
        />
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 ml-6">
        {/* Video Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <div className={`p-2 rounded-lg ${badge.bgColor} transition-all duration-300 group-hover:scale-110 group-hover:ring-2 ${badge.ringColor}`}>
              <span className="text-lg">{badge.icon}</span>
            </div>
          </div>
          
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 
                  className="text-sm font-medium text-gray-200 truncate group-hover:text-clip transition-all duration-300"
                  title={video.title || video._id || 'بدون عنوان'}
                >
                  {video.title || video._id || 'بدون عنوان'}
                </h3>
                {isHovered && (
                  <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <span>👁️</span>
                    <span>عرض التفاصيل</span>
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {lectureTitle && (
                  <span className="text-gray-400 px-2 py-1 bg-gray-900/50 rounded-full">
                    {lectureTitle}
                  </span>
                )}
                
                <div className="flex items-center gap-1 text-gray-500">
                  <span>⏱️</span>
                  <span>{duration}</span>
                </div>
                
                {video.lastChecked && (
                  <div className="text-gray-500">
                    آخر فحص: {formatDate(video.lastChecked)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Status and Actions */}
        <div className="flex items-center gap-4">
          {/* Status Badge */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all duration-300 ${badge.color} ${
            isHovered ? 'shadow-lg scale-105' : ''
          }`}>
            <span className="text-sm">{badge.icon}</span>
            <span>{badge.label}</span>
          </div>
          
          {/* Recheck Button */}
          <button
            className={`relative overflow-hidden px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${
              isRechecking
                ? 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 cursor-not-allowed'
                : `bg-gradient-to-r ${badge.gradient} text-white hover:shadow-xl hover:scale-105 active:scale-95`
            }`}
            onClick={handleRecheck}
            disabled={isRechecking}
            aria-label={`إعادة فحص الفيديو ${video.title}`}
          >
            {!isRechecking && <ShimmerEffect />}
            {isRechecking ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                <span className="hidden sm:inline">جاري الفحص...</span>
              </>
            ) : (
              <>
                <span className="transform transition-transform duration-300 group-hover:rotate-180">↻</span>
                <span className="hidden sm:inline">إعادة فحص</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function LectureRow({ lecture, onRecheckVideo, onRecheckAll, selected, onSelect, onOpenModal }) {
  const [open, setOpen] = useState(false);
  const [isRecheckingAll, setIsRecheckingAll] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  
  const handleRecheckAll = async (e) => {
    e.stopPropagation();
    setIsRecheckingAll(true);
    await onRecheckAll(lecture);
    setTimeout(() => setIsRecheckingAll(false), 3000);
  };
  
  const healthPercentage = lecture.total > 0 
    ? Math.round((lecture.working / lecture.total) * 100) 
    : 0;
  
  const getHealthColor = (percentage) => {
    if (percentage >= 80) return 'text-emerald-400';
    if (percentage >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };
  
  const getHealthGradient = (percentage) => {
    if (percentage >= 80) return 'from-emerald-500 to-emerald-600';
    if (percentage >= 60) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
  };
  
  const getHealthBg = (percentage) => {
    if (percentage >= 80) return 'bg-emerald-900/20';
    if (percentage >= 60) return 'bg-amber-900/20';
    return 'bg-rose-900/20';
  };
  
  const handleSelectVideo = (videoId) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };
  
  const handleSelectAllVideos = () => {
    if (!Array.isArray(lecture.videos)) return;
    
    if (selectedVideos.size === lecture.videos.length) {
      setSelectedVideos(new Set());
    } else {
      const allIds = lecture.videos.map(v => v._id || v.id);
      setSelectedVideos(new Set(allIds));
    }
  };
  
  const handleExpand = () => {
    setIsExpanding(true);
    setOpen(!open);
    setTimeout(() => setIsExpanding(false), 300);
  };
  
  return (
    <div className={`relative border border-gray-800 rounded-xl shadow-lg mb-4 overflow-hidden bg-gray-900/50 backdrop-blur-sm hover:shadow-2xl transition-all duration-500 ${
      selected ? 'ring-2 ring-blue-500/50 ring-opacity-50' : ''
    } ${open ? 'shadow-xl' : ''}`}>
      {/* Health indicator bar */}
      <div 
        className={`absolute top-0 left-0 h-1 bg-gradient-to-r ${getHealthGradient(healthPercentage)} transition-all duration-1000`}
        style={{ width: `${healthPercentage}%` }}
      ></div>
      
      {/* Lecture Header */}
      <div 
        className="flex flex-col lg:flex-row lg:items-center justify-between px-4 py-4 cursor-pointer bg-gradient-to-r from-gray-900/80 to-gray-900/50 hover:from-blue-900/20 hover:to-purple-900/20 transition-all duration-500 relative overflow-hidden group"
        onClick={handleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleExpand()}
        aria-label={`تفاصيل محاضرة ${lecture.lectureTitle}`}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20"></div>
        </div>
        
        {/* Left Section */}
        <div className="relative flex items-start lg:items-center gap-3 mb-3 lg:mb-0">
          <div className="flex-shrink-0">
            <div className={`p-2 rounded-lg transition-all duration-500 transform ${
              open ? 'bg-blue-900/50 text-blue-400 rotate-90' : 'bg-gray-800 text-gray-400'
            } ${isExpanding ? 'scale-125' : ''} group-hover:scale-110`}>
              {open ? '▼' : '►'}
            </div>
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-100 truncate">
                {lecture.lectureTitle || `محاضرة ${lecture.lectureId}`}
              </h2>
              {selected && (
                <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full">
                  ✓ مختارة
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <span className="text-gray-500">🎬</span>
                <span>{lecture.total} فيديو</span>
              </span>
              
              <span className={`flex items-center gap-1 font-semibold ${getHealthColor(healthPercentage)}`}>
                <span className="text-gray-500">📊</span>
                <span>{healthPercentage}% صحة</span>
              </span>
              
              {lecture.lastUpdated && (
                <span className="flex items-center gap-1">
                  <span className="text-gray-500">🕐</span>
                  <span>{new Date(lecture.lastUpdated).toLocaleDateString('ar-EG')}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right Section */}
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
          {/* Status counters */}
          <div className="flex gap-4">
            {[
              { label: 'شغال', value: lecture.working, color: 'emerald', icon: '✓' },
              { label: 'معطل', value: lecture.broken, color: 'rose', icon: '✗' },
              { label: 'قيد الفحص', value: lecture.checking || 0, color: 'amber', icon: '⏳' },
            ].map((stat, idx) => (
              <div 
                key={stat.label} 
                className="text-center transform transition-all duration-500 hover:scale-110"
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
                <div className={`relative text-xl font-bold text-${stat.color}-400 flex items-center justify-center gap-1`}>
                  <span className="text-sm">{stat.icon}</span>
                  <span>{stat.value}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              className={`relative overflow-hidden px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all duration-500 ${
                isRecheckingAll
                  ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:shadow-2xl hover:scale-105 active:scale-95'
              }`}
              onClick={handleRecheckAll}
              disabled={isRecheckingAll}
              aria-label="إعادة فحص جميع فيديوهات المحاضرة"
            >
              {!isRecheckingAll && <ShimmerEffect />}
              {isRecheckingAll ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>جاري فحص الكل...</span>
                </>
              ) : (
                <>
                  <span className="text-lg transform transition-transform hover:rotate-180">↻</span>
                  <span>إعادة فحص الكل</span>
                </>
              )}
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(lecture.lectureId || lecture.lectureTitle);
              }}
              className={`hidden lg:block px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                selected 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
              }`}
              aria-label={selected ? 'إلغاء تحديد المحاضرة' : 'تحديد المحاضرة'}
            >
              {selected ? 'إلغاء' : 'تحديد'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {open && (
        <div className="bg-gradient-to-b from-gray-900/50 to-gray-900/30 border-t border-gray-800 animate-slideDown">
          {/* Videos Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20 text-sm text-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span>تفاصيل الفيديوهات</span>
              <span className="px-2 py-1 bg-gray-800 rounded-full font-medium">
                {Array.isArray(lecture.videos) ? lecture.videos.length : 0} فيديو
              </span>
            </div>
            
            {Array.isArray(lecture.videos) && lecture.videos.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAllVideos}
                  className="px-3 py-1 text-xs bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                  aria-label="تحديد أو إلغاء تحديد جميع الفيديوهات"
                >
                  {selectedVideos.size === lecture.videos.length ? 'إلغاء تحديد الكل' : 'تحديد كل الفيديوهات'}
                </button>
                <span className="text-xs text-blue-400">
                  {selectedVideos.size} مختار
                </span>
              </div>
            )}
          </div>
          
          {/* Videos List */}
          {Array.isArray(lecture.videos) && lecture.videos.length > 0 ? (
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
              {lecture.videos.map((v, idx) => (
                <VideoRow 
                  key={v._id || v.id} 
                  video={v} 
                  onRecheck={onRecheckVideo}
                  lectureTitle={lecture.lectureTitle}
                  selected={selectedVideos.has(v._id || v.id)}
                  onSelect={handleSelectVideo}
                  onOpenModal={onOpenModal}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500 animate-pulse">
              <div className="text-4xl mb-4">📹</div>
              <div className="text-lg mb-2">لا توجد تفاصيل للفيديوهات</div>
              <div className="text-sm max-w-md mx-auto">
                نظام الملفات الحالي لا يوفر تفاصيل لكل فيديو، يرجى الرجوع للدعم الفني لإضافة العناوين.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminVideoStatusOverview() {
  const [summary, setSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVideo, setModalVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedLectures, setSelectedLectures] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [viewMode, setViewMode] = useState('cards');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Auto-refresh effect
  useEffect(() => {
    let interval;
    if (autoRefresh && !loading) {
      interval = setInterval(() => {
        fetchSummary(true);
      }, 30000); // 30 seconds
    }
    return () => clearInterval(interval);
  }, [autoRefresh, loading]);
  
  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 4000);
  };
  
  const fetchSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const res = await adminAPI.getVideoStatusSummary();
      const updatedSummary = res.data || null;
      if (updatedSummary && Array.isArray(updatedSummary.perLecture)) {
        updatedSummary.perLecture.forEach(lecture => {
          if (Array.isArray(lecture.videos)) {
            lecture.checking = lecture.videos.filter(v => v.status === 'checking').length;
            // Calculate last updated time
            if (lecture.videos.length > 0) {
              const dates = lecture.videos
                .map(v => v.lastChecked && new Date(v.lastChecked))
                .filter(d => d)
                .sort((a, b) => b - a);
              lecture.lastUpdated = dates[0] || null;
            }
          } else {
            lecture.checking = 0;
          }
        });
        
        updatedSummary.checking = updatedSummary.perLecture.reduce((sum, lecture) => sum + (lecture.checking || 0), 0);
        updatedSummary.lastUpdated = new Date().toISOString();
      }
      setSummary(updatedSummary);
      setStatsLoaded(true);
    } catch (err) {
      console.error('fetchSummary', err);
      setSummary(null);
      showNotification('فشل في تحميل بيانات حالة الفيديوهات', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const openVideoModal = (video) => {
    setModalVideo(video);
    setModalOpen(true);
  };

  const closeVideoModal = () => {
    setModalOpen(false);
    setModalVideo(null);
  };
  
  const handleRecheckVideo = async (video) => {
    setSummary((s) => {
      if (!s) return s;
      return {
        ...s,
        perLecture: s.perLecture.map(l => ({
          ...l,
          videos: Array.isArray(l.videos) 
            ? l.videos.map(v => (v._id === video._id || v.id === video.id ? { ...v, status: 'checking' } : v)) 
            : l.videos,
        })),
      };
    });
    
    try {
      await adminAPI.recheckVideo(video._id || video.id);
      showNotification(`بدأنا إعادة الفحص لـ "${video.title || video._id}"`, 'success');
      setTimeout(() => fetchSummary(true), 2000);
    } catch (e) {
      console.error('recheck failed', e);
      showNotification('فشل في إعادة فحص الفيديو', 'error');
      fetchSummary(true);
    }
  };
  
  const handleRecheckAll = async (lecture) => {
    if (!Array.isArray(lecture.videos)) return;
    
    setSummary((s) => {
      if (!s) return s;
      return {
        ...s,
        perLecture: s.perLecture.map(l => 
          l.lectureId === lecture.lectureId
            ? {
                ...l,
                videos: Array.isArray(l.videos) 
                  ? l.videos.map(v => ({ ...v, status: 'checking' })) 
                  : l.videos,
              }
            : l
        ),
      };
    });
    
    try {
      for (const v of lecture.videos) {
        await adminAPI.recheckVideo(v._id || v.id);
      }
      showNotification(`بدأنا إعادة الفحص لكل الفيديوهات في "${lecture.lectureTitle}"`, 'success');
      setTimeout(() => fetchSummary(true), 3000);
    } catch (e) {
      console.error('Batch recheck failed', e);
      showNotification('فشل في إعادة فحص بعض الفيديوهات', 'error');
      fetchSummary(true);
    }
  };
  
  const handleBulkRecheck = async () => {
    if (selectedLectures.size === 0) {
      showNotification('الرجاء تحديد محاضرة واحدة على الأقل', 'warning');
      return;
    }
    
    if (!summary || !Array.isArray(summary.perLecture)) return;
    
    const selectedLectureData = summary.perLecture.filter(l => 
      selectedLectures.has(l.lectureId || l.lectureTitle)
    );
    
    if (selectedLectureData.length === 0) return;
    
    setSummary((s) => {
      if (!s) return s;
      return {
        ...s,
        perLecture: s.perLecture.map(l => 
          selectedLectures.has(l.lectureId || l.lectureTitle) && Array.isArray(l.videos)
            ? {
                ...l,
                videos: l.videos.map(v => ({ ...v, status: 'checking' })),
              }
            : l
        ),
      };
    });
    
    try {
      for (const lecture of selectedLectureData) {
        if (Array.isArray(lecture.videos)) {
          for (const v of lecture.videos) {
            await adminAPI.recheckVideo(v._id || v.id);
          }
        }
      }
      
      showNotification(`بدأنا إعادة الفحص لـ ${selectedLectureData.length} محاضرة`, 'success');
      setSelectedLectures(new Set());
      setBulkAction('');
      setTimeout(() => fetchSummary(true), 4000);
    } catch (e) {
      console.error('Bulk recheck failed', e);
      showNotification('فشل في إعادة الفحص المجمعة', 'error');
      fetchSummary(true);
    }
  };
  
  const handleSelectLecture = (lectureId) => {
    const newSelected = new Set(selectedLectures);
    if (newSelected.has(lectureId)) {
      newSelected.delete(lectureId);
    } else {
      newSelected.add(lectureId);
    }
    setSelectedLectures(newSelected);
  };
  
  const handleSelectAll = () => {
    if (!summary || !Array.isArray(summary.perLecture)) return;
    
    if (selectedLectures.size === summary.perLecture.length) {
      setSelectedLectures(new Set());
    } else {
      const allIds = summary.perLecture.map(l => l.lectureId || l.lectureTitle);
      setSelectedLectures(new Set(allIds));
    }
  };
  
  const filteredLectures = useMemo(() => {
    if (!summary || !Array.isArray(summary.perLecture)) return [];
    
    const q = query.trim().toLowerCase();
    
    return summary.perLecture
      .map(l => ({ ...l }))
      .filter(l => {
        if (q) {
          const title = (l.lectureTitle || '').toLowerCase();
          const videosMatch = Array.isArray(l.videos) && 
            l.videos.some(v => (v.title || '').toLowerCase().includes(q));
          return title.includes(q) || videosMatch;
        }
        return true;
      })
      .map(l => {
        if (filter === 'all' || !Array.isArray(l.videos)) return l;
        
        const vs = l.videos.filter(v => {
          const st = v.status || 'unknown';
          return filter === st;
        });
        
        return { ...l, videos: vs };
      })
      .filter(l => {
        if (filter === 'all') return true;
        return Array.isArray(l.videos) ? l.videos.length > 0 : true;
      });
  }, [summary, filter, query]);
  
  const overallHealth = summary && summary.total > 0 
    ? Math.round((summary.working / summary.total) * 100) 
    : 0;
  
  const getHealthBarColor = (percentage) => {
    if (percentage >= 80) return 'bg-gradient-to-r from-emerald-500 to-emerald-600';
    if (percentage >= 60) return 'bg-gradient-to-r from-amber-500 to-amber-600';
    return 'bg-gradient-to-r from-rose-500 to-rose-600';
  };
  
  // Export data function
  const exportData = () => {
    if (!summary) return;
    
    const data = {
      exportDate: new Date().toISOString(),
      summary: {
        total: summary.total,
        working: summary.working,
        broken: summary.broken,
        checking: summary.checking,
        health: overallHealth
      },
      lectures: filteredLectures
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-status-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('تم تصدير البيانات بنجاح', 'success');
  };
  
  // Quick actions
  const quickActions = [
    { label: 'فحص الجميع', action: () => handleSelectAll() && setBulkAction('recheck') && handleBulkRecheck(), icon: '🔍' },
    { label: 'تصدير التقرير', action: exportData, icon: '📥' },
    { label: 'إعادة تحميل', action: () => fetchSummary(true), icon: '🔄' },
  ];
  
  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 text-gray-100">
      {/* Custom CSS for animations */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .scrollbar-thin {
          scrollbar-width: thin;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
        .glass-effect {
          background: rgba(17, 24, 39, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
      
      {/* Notification Toast */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-2xl flex items-center space-x-3 animate-slideDown transform transition-all duration-300 glass-effect ${
          notification.type === 'success' 
            ? 'border-emerald-500/20' 
            : notification.type === 'error'
            ? 'border-rose-500/20'
            : 'border-blue-500/20'
        }`}>
          <div className={`h-3 w-3 rounded-full ${
            notification.type === 'success' ? 'bg-emerald-500' :
            notification.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
          }`}></div>
          <div className="flex-1">
            <span className="font-medium">{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification({ show: false, message: '', type: 'info' })}
            className="text-xl font-bold hover:scale-125 transition-transform text-gray-400 hover:text-gray-200"
            aria-label="إغلاق الإشعار"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Video Details Modal */}
      {modalOpen && modalVideo && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={closeVideoModal}
            aria-label="إغلاق النافذة"
          />
          <div className="bg-gray-900 border border-gray-800 max-w-2xl w-full rounded-xl p-6 z-10 shadow-2xl animate-slideDown">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="font-bold text-xl text-gray-100 mb-1">
                  {modalVideo.title || modalVideo._id}
                </h4>
                <p className="text-sm text-gray-400">تفاصيل الفيديو</p>
              </div>
              <button 
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                onClick={closeVideoModal}
                aria-label="إغلاق"
              >
                <span className="text-xl">✕</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">معرّف الفيديو</div>
                  <div className="text-sm font-mono text-gray-300">{modalVideo._id}</div>
                </div>
                
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">الحالة</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_BADGES[modalVideo.status]?.color || STATUS_BADGES.unknown.color}`}>
                      {STATUS_BADGES[modalVideo.status]?.label || 'غير معروف'}
                    </span>
                  </div>
                </div>
              </div>
              
              {modalVideo.url && (
                <div className="bg-gray-800/50 p-3 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">رابط الفيديو</div>
                  <a 
                    href={modalVideo.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2"
                  >
                    <span>🔗</span>
                    <span className="truncate">{modalVideo.url}</span>
                  </a>
                </div>
              )}
              
              {modalVideo.lastChecked && (
                <div className="text-sm text-gray-400">
                  آخر فحص: {new Date(modalVideo.lastChecked).toLocaleString('ar-EG')}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-800">
              <button 
                onClick={closeVideoModal}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
              >
                إغلاق
              </button>
              <button 
                onClick={() => { handleRecheckVideo(modalVideo); closeVideoModal(); }} 
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all flex items-center gap-2"
              >
                <span>↻</span>
                <span>إعادة فحص الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl">
                  <span className="text-2xl">🎬</span>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-1">
                    لوحة تحليل حالة الفيديوهات
                  </h1>
                  <p className="text-gray-400 max-w-2xl">
                    رقابة وحالة فيديوهات المحاضرات مع تحديثات فورية وإحصاءات تفصيلية
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Quick Actions */}
              <div className="flex gap-2">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={action.action}
                    className="p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-all group relative"
                    title={action.label}
                  >
                    <span className="text-lg">{action.icon}</span>
                    <span className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
              
              {/* Settings */}
              <div className="relative">
                <button 
                  className="p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-all"
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label="الإعدادات"
                >
                  <span className="text-lg">⚙️</span>
                </button>
                
                {showFilters && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-3 z-10 animate-slideDown">
                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer">
                        <span className="text-sm">التحديث التلقائي</span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-10 h-6 rounded-full transition-all ${autoRefresh ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoRefresh ? 'left-5' : 'left-1'}`}></div>
                          </div>
                        </div>
                      </label>
                      
                      <div className="p-2">
                        <div className="text-xs text-gray-400 mb-2">نمط العرض</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setViewMode('cards')}
                            className={`flex-1 p-2 rounded-lg text-sm ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                          >
                            🗂️ بطاقات
                          </button>
                          <button
                            onClick={() => setViewMode('list')}
                            className={`flex-1 p-2 rounded-lg text-sm ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                          >
                            📋 قائمة
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'إجمالي الفيديوهات', value: summary ? summary.total : '0', color: 'blue', icon: '🎬', subtext: 'عبر جميع المحاضرات' },
            { label: 'شغال', value: summary ? summary.working : '0', color: 'emerald', icon: '✓', subtext: summary ? `${Math.round((summary.working / summary.total) * 100)}% من الإجمالي` : '0%' },
            { label: 'معطل', value: summary ? summary.broken : '0', color: 'rose', icon: '✗', subtext: summary ? `${Math.round((summary.broken / summary.total) * 100)}% من الإجمالي` : '0%' },
            { label: 'قيد الفحص', value: summary ? summary.checking || 0 : '0', color: 'amber', icon: '⏳', subtext: 'قيد التحقق حاليًا' },
          ].map((stat, idx) => (
            <div 
              key={stat.label}
              className={`glass-effect rounded-xl p-5 transform transition-all duration-500 hover:scale-105 hover:shadow-xl ${
                statsLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ transitionDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-400">{stat.label}</div>
                <div className={`p-2 bg-${stat.color}-900/30 rounded-lg`}>
                  <span className="text-xl">{stat.icon}</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-100 mb-1">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.subtext}</div>
            </div>
          ))}
        </div>
        
        {/* Health Bar */}
        <div className="glass-effect rounded-xl p-5 mb-6 animate-slideDown">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
            <div className="flex items-center gap-3 mb-3 sm:mb-0">
              <div className="text-lg font-semibold text-gray-100">حالة النظام العامة</div>
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                overallHealth >= 80 ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/50' :
                overallHealth >= 60 ? 'bg-amber-900/30 text-amber-400 border border-amber-700/50' :
                'bg-rose-900/30 text-rose-400 border border-rose-700/50'
              }`}>
                {overallHealth}%
              </div>
            </div>
            {summary && summary.lastUpdated && (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>🕐</span>
                <span>آخر تحديث: {new Date(summary.lastUpdated).toLocaleString('ar-EG')}</span>
              </div>
            )}
          </div>
          
          <div className="relative w-full bg-gray-800 rounded-full h-4 mb-2">
            <div 
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${getHealthBarColor(overallHealth)}`}
              style={{ width: `${overallHealth}%` }}
            >
              <ShimmerEffect />
            </div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
              <span>ضعيف</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span>جيد</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>ممتاز</span>
            </div>
          </div>
        </div>
        
        {/* Search and Filters Bar */}
        <div className="glass-effect rounded-xl p-5 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative group">
                <input
                  type="text"
                  placeholder="ابحث في المحاضرات أو الفيديوهات..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-12 pr-10 py-3 bg-gray-800/50 border border-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300 placeholder-gray-500"
                  aria-label="بحث في المحاضرات والفيديوهات"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:scale-110 transition-transform">
                  🔍
                </div>
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    aria-label="مسح البحث"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            {/* Filters and Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)} 
                className="px-4 py-3 bg-gray-800/50 border border-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                aria-label="تصفية حسب الحالة"
              >
                <option value="all">جميع الحالات</option>
                <option value="working">شغال فقط</option>
                <option value="broken">معطل فقط</option>
                <option value="checking">قيد الفحص</option>
                <option value="unknown">غير معروف</option>
              </select>
              
              <button
                onClick={() => fetchSummary(true)}
                disabled={refreshing}
                className="px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-gray-100 rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                aria-label="تحديث البيانات"
              >
                {refreshing ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-transparent rounded-full"></span>
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <>
                    <span className="transform hover:rotate-180 transition-transform">↻</span>
                    <span>تحديث</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Bulk Actions */}
          {selectedLectures.size > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">محدد:</span>
                  <span className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-sm">
                    {selectedLectures.size} محاضرة
                  </span>
                </div>
                
                <select 
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="px-4 py-2 bg-gray-800/50 border border-gray-700 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm"
                  aria-label="إجراءات جماعية"
                >
                  <option value="">اختر إجراءً</option>
                  <option value="recheck">إعادة فحص المحدد</option>
                </select>
                
                <button
                  onClick={handleBulkRecheck}
                  disabled={!bulkAction}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="تطبيق الإجراء الجماعي"
                >
                  تطبيق الإجراء
                </button>
                
                <button
                  onClick={() => setSelectedLectures(new Set())}
                  className="px-4 py-2 text-gray-400 hover:text-gray-300 text-sm"
                  aria-label="إلغاء التحديد"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Main Content */}
        {loading ? (
          <div className="glass-effect rounded-xl p-8 text-center animate-pulse">
            <div className="inline-block animate-spin h-16 w-16 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <div className="text-lg font-medium text-gray-300 mb-2">جاري تحميل بيانات حالة الفيديوهات...</div>
            <div className="text-sm text-gray-500">يرجى الانتظار قليلاً</div>
          </div>
        ) : (
          <div>
            {/* Lectures Header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-100">
                  المحاضرات ({filteredLectures.length})
                </h2>
                {summary && Array.isArray(summary.perLecture) && (
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1 text-sm bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="تحديد أو إلغاء تحديد جميع المحاضرات"
                  >
                    {selectedLectures.size === filteredLectures.length && filteredLectures.length > 0
                      ? 'إلغاء تحديد الكل' 
                      : 'تحديد الكل'}
                  </button>
                )}
              </div>
              
              {summary && (
                <div className="text-sm text-gray-500">
                  {Array.isArray(summary.perLecture) 
                    ? `عرض ${filteredLectures.length} من أصل ${summary.perLecture.length} محاضرة`
                    : 'لا توجد محاضرات'}
                </div>
              )}
            </div>
            
            {/* Lectures List */}
            {filteredLectures.length === 0 ? (
              <div className="glass-effect rounded-xl p-8 text-center animate-slideDown">
                <div className="text-5xl mb-6">📹</div>
                <div className="text-xl font-medium text-gray-300 mb-3">لا توجد محاضرات</div>
                <div className="text-gray-500 mb-8 max-w-md mx-auto">
                  {query 
                    ? `لا توجد محاضرات تطابق "${query}"`
                    : 'لا توجد بيانات محاضرات متاحة حاليًا'}
                </div>
                {query && (
                  <button 
                    onClick={() => setQuery('')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                    aria-label="مسح البحث"
                  >
                    مسح البحث
                  </button>
                )}
              </div>
            ) : (
              <div className={viewMode === 'cards' ? 'space-y-4' : ''}>
                {filteredLectures.map((lecture, idx) => (
                  <div 
                    key={lecture.lectureId || lecture.lectureTitle}
                    className={viewMode === 'list' ? 'mb-4' : ''}
                  >
                    {viewMode === 'list' && (
                      <div className="absolute left-4 top-6 z-10">
                        <input
                          type="checkbox"
                          checked={selectedLectures.has(lecture.lectureId || lecture.lectureTitle)}
                          onChange={() => handleSelectLecture(lecture.lectureId || lecture.lectureTitle)}
                          className="h-5 w-5 text-blue-500 rounded border-gray-700 bg-gray-900 focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                          aria-label={`تحديد محاضرة ${lecture.lectureTitle}`}
                        />
                      </div>
                    )}
                    <div className={viewMode === 'list' ? 'ml-10' : ''}>
                      <LectureRow 
                        lecture={lecture} 
                        onRecheckVideo={handleRecheckVideo}
                        onRecheckAll={handleRecheckAll}
                        selected={selectedLectures.has(lecture.lectureId || lecture.lectureTitle)}
                        onSelect={handleSelectLecture}
                        onOpenModal={openVideoModal}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Footer */}
        {!loading && summary && (
          <div className="mt-8 pt-6 border-t border-gray-800">
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
                <span>صحة النظام:</span>
                <span className={`font-bold ${
                  overallHealth >= 80 ? 'text-emerald-400' :
                  overallHealth >= 60 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {overallHealth}%
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-400">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <span>الفيديوهات النشطة:</span>
                <span className="font-bold text-gray-300">{summary.working} / {summary.total}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-400">
                <div className="h-2 w-2 bg-gray-500 rounded-full"></div>
                <span>الوقت الحالي:</span>
                <span className="font-bold text-gray-300">{new Date().toLocaleString('ar-EG')}</span>
              </div>
            </div>
            
            {/* Auto Refresh Indicator */}
            {autoRefresh && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-full text-xs text-gray-400">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span>التحديث التلقائي مفعل (كل 30 ثانية)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}