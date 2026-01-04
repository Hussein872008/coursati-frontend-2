import React, { useState, useEffect } from "react";
import useTitle from "../../hooks/useTitle";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { instructorAPI, chapterAPI } from "../../utils/api";
import UserHeader from "../../components/user/UserHeader";
import UserFooter from "../../components/user/UserFooter";
import {
  BookOpenIcon,
  ClockIcon,
  StarIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  VideoCameraIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  StarIcon as StarSolid,
  CheckCircleIcon as CheckCircleSolid,
  TrophyIcon as TrophySolid,
  AcademicCapIcon as AcademicCapSolid,
} from "@heroicons/react/24/solid";

const InstructorDetailsPage = () => {
  useTitle("كورساتي — الفصول  ");
  const navigate = useNavigate();
  const { instructorId } = useParams();
  const { user } = useAuth();
  const [instructor, setInstructor] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLectureId, setSelectedLectureId] = useState(null);
  const [expandedChapters, setExpandedChapters] = useState({});
  const [stats, setStats] = useState({
    totalChapters: 0,
    totalLectures: 0,
    totalVideos: 0,
    totalPDFs: 0,
    totalHours: 0,
    rating: 4.8,
    students: 2500,
    completionRate: 92,
  });
  const [activeTab, setActiveTab] = useState("content");
  const [hoveredChapter, setHoveredChapter] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const instructorRes =
          await instructorAPI.getInstructorById(instructorId);
        setInstructor(instructorRes.data);

        const chaptersRes =
          await chapterAPI.getChaptersByInstructor(instructorId);
        // sort chapters newest first
        const fetched = chaptersRes.data || [];
        const sorted = Array.isArray(fetched)
          ? fetched.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          : fetched;
        setChapters(sorted);

        // حساب الإحصائيات
        let totalLectures = 0;
        let totalVideos = 0;
        let totalPDFs = 0;
        let totalHours = 0;

        // use sorted chapters for stats
        (sorted || []).forEach((chapter) => {
          totalLectures += chapter.lectures?.length || 0;
          chapter.lectures?.forEach((lecture) => {
            totalVideos += lecture.videos?.length || 0;
            totalPDFs += lecture.pdfs?.length || 0;
            totalHours += lecture.duration || 0;
          });
        });

        setStats({
          totalChapters: chaptersRes.data?.length || 0,
          totalLectures,
          totalVideos,
          totalPDFs,
          totalHours: Math.ceil(totalHours / 60),
          rating: 4.8,
          students: 2500,
          completionRate: 92,
        });

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadData();
  }, [instructorId]);

  const toggleChapter = (chapterId) => {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const handleLectureSelect = (lectureId) => {
    setSelectedLectureId(lectureId);
    // تحريك الشاشة للمحتوى على الأجهزة الصغيرة
    if (window.innerWidth < 768) {
      document
        .getElementById("lecture-content")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <StarSolid
            key={i}
            className={`w-5 h-5 ${i < Math.floor(rating) ? "text-yellow-400" : "text-gray-600"}`}
          />
        ))}
        <span className="text-white/80 text-sm mr-1">{rating}</span>
      </div>
    );
  };

  const getLectureIcon = (lecture) => {
    if (lecture.videos?.length > 0)
      return <VideoCameraIcon className="w-4 h-4 text-cyan-400" />;
    if (lecture.pdfs?.length > 0)
      return <DocumentTextIcon className="w-4 h-4 text-purple-400" />;
    return <BookOpenIcon className="w-4 h-4 text-emerald-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-white/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/80 text-lg">جاري تحميل تفاصيل المدرس...</p>
          <p className="text-white/60 text-sm mt-2">
            جاري تحميل الفصول والمحاضرات
          </p>
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
        {/* معلومات المدرس */}
        {instructor && (
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* صورة المدرس */}
              <div className="lg:w-1/3">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative overflow-hidden rounded-2xl border-2 border-white/10 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl">
                    {instructor.thumbnailUrl ? (
                      <img
                        src={instructor.thumbnailUrl}
                        alt={instructor.title}
                        className="w-full h-40 sm:h-56 md:h-64 lg:h-80 object-cover object-top md:group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-40 sm:h-56 md:h-64 lg:h-80 bg-gradient-to-br from-purple-900/40 to-blue-900/40 flex items-center justify-center">
                        <UserGroupIcon className="w-16 h-16 sm:w-20 sm:h-20 text-white/30" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* معلومات المدرس */}
              <div className="lg:w-2/3">
                <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
                        {instructor.title}
                      </h1>
                    </div>
                  </div>

                  {/* إحصائيات المادة */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <BookOpenIcon className="w-5 h-5 text-cyan-400" />
                        <div>
                          <div className="text-sm text-white/60">الفصول</div>
                          <div className="font-bold text-white">
                            {stats.totalChapters}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <AcademicCapIcon className="w-5 h-5 text-purple-400" />
                        <div>
                          <div className="text-sm text-white/60">المحاضرات</div>
                          <div className="font-bold text-white">
                            {stats.totalLectures}
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

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-8 p-4 bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 rounded-2xl backdrop-blur-sm">
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
              <div className="text-white">{error}</div>
            </div>
          </div>
        )}

        {/* الفصول */}
        <div>
          <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                الفصول والمحاضرات
              </h3>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <PlayCircleIcon className="w-4 h-4" />
                <span>{stats.totalLectures} محاضرة</span>
              </div>
            </div>

            {chapters.length === 0 ? (
              <div className="text-center py-20">
                <BookOpenIcon className="w-14 h-14 text-white/25 mx-auto mb-4" />
                <p className="text-white/60 text-sm">لا توجد فصول بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {chapters.map((chapter) => (
                  <button
                    key={chapter._id}
                    onClick={() => navigate(`/chapter/${chapter._id}`)}
                    className="group rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:border-purple-500/40 hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  >
                    {/* Thumbnail */}
                    {chapter.thumbnailUrl ? (
                      <img
                        src={chapter.thumbnailUrl}
                        alt={chapter.title}
                        loading="lazy"
                        className="w-full h-32 sm:h-40 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 sm:h-40 bg-white/5 flex items-center justify-center">
                        <BookOpenIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white/30" />
                      </div>
                    )}

                    {/* Content: title and lectures count on single row with simple badge */}
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-base font-semibold text-white line-clamp-2 text-right">
                          {chapter.title}
                        </h4>
                        <div className="text-xs bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-white/90 px-3 py-1 rounded-full whitespace-nowrap">
                          {chapter.lectures?.length || 0} محاضرة
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <UserFooter />
    </div>
  );
};

export default InstructorDetailsPage;
