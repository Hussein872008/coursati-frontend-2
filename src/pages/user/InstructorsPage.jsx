import React, { useState, useEffect } from "react";
import useTitle from "../../hooks/useTitle";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { materialAPI, instructorAPI } from "../../utils/api";
import UserHeader from "../../components/user/UserHeader";
import UserFooter from "../../components/user/UserFooter";
import {
  UserGroupIcon,
  AcademicCapIcon,
  BookOpenIcon,
} from "@heroicons/react/24/outline";
// No solid icons needed

const InstructorsPage = () => {
  useTitle("كورساتي — مدرسين المادة");
  const navigate = useNavigate();
  const { materialId } = useParams();
  const { user } = useAuth();
  const [material, setMaterial] = useState(null);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredInstructor, setHoveredInstructor] = useState(null);

  const handleCardKeyDown = (e, instructorId) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      handleInstructorClick(instructorId);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [materialRes, instructorsRes] = await Promise.all([
          materialAPI.getMaterialById(materialId),
          instructorAPI.getInstructorsByMaterial(materialId),
        ]);
        setMaterial(materialRes.data);
        setInstructors(instructorsRes.data || []);

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadData();
  }, [materialId]);

  const handleInstructorClick = (instructorId) => {
    navigate(`/instructor/${instructorId}`);
  };

  const getInstructorStats = (instructor) => {
    // استخدام البيانات الحقيقية من Backend
    return {
      chapters: instructor.chaptersCount || 0,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-white/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/80 text-lg">جاري تحميل بيانات المدرسين...</p>
          <p className="text-white/60 text-sm mt-2">
            جاري تحميل المادة والمدرسين
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
        {/* رأس المادة */}
        {material && (
          <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 border border-white/10 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 text-center md:text-right">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {material.title}
                </h1>
                <p className="text-white/70 mt-2">
                  اختر مدرساً للبدء في التعلم
                </p>
              </div>

              {/* صورة المادة */}
              <div className="w-full md:w-40 h-28 md:h-40 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                {material.thumbnailUrl ? (
                  <img
                    src={material.thumbnailUrl}
                    alt={material.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <BookOpenIcon className="w-10 h-10 text-white/30" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-8 p-4  border border-red-500/30 rounded-2xl backdrop-blur-sm">
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

        {/* عنوان المدرسين */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              المدرسون المتخصصون
            </h2>
            <p className="text-white/70">اختر مدرساً لمتابعة المحاضرات</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl">
            <UserGroupIcon className="w-5 h-5 text-emerald-400" />
            <span className="text-white/80">{instructors.length} مدرس</span>
          </div>
        </div>
        {/* بطاقات المدرسين */}
        {instructors.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-gray-800/40 to-gray-900/40 border-2 border-dashed border-white/20 flex items-center justify-center mx-auto mb-6">
              <UserGroupIcon className="w-12 h-12 text-white/40" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              لا يوجد مدرسون لهذه المادة
            </h3>
            <p className="text-white/60 mb-8">
              لم يتم تعيين أي مدرس لهذه المادة بعد
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all duration-300"
            >
              العودة للمواد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {instructors.map((instructor) => {
              const instructorStats = getInstructorStats(instructor);
              const isHovered = hoveredInstructor === instructor._id;

              return (
                <div
                  key={instructor._id}
                  className="group relative"
                  onMouseEnter={() => setHoveredInstructor(instructor._id)}
                  onMouseLeave={() => setHoveredInstructor(null)}
                >
                  {/* تأثير اللمعان */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-2xl blur-xl transition-opacity duration-500 ${isHovered ? "opacity-100" : "opacity-0"}`}
                  />

                  {/* البطاقة الرئيسية */}
                  <div
                    onClick={() => handleInstructorClick(instructor._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => handleCardKeyDown(e, instructor._id)}
                    className="relative bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-500 cursor-pointer transform hover:-translate-y-2 h-full flex flex-col"
                  >
                    {/* رأس البطاقة - صورة وخلفية */}
                    <div className="relative h-40 md:h-56 overflow-hidden flex-shrink-0">
                      {/* خلفية متدرجة */}
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-teal-900/40" />

                      {/* صورة المدرس */}
                      {instructor.thumbnailUrl ? (
                        <img
                          src={instructor.thumbnailUrl}
                          alt={instructor.title}
                          className="w-full h-full object-cover object-top opacity-60 group-hover:opacity-70 transition-opacity duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserGroupIcon className="w-24 h-24 text-white/20" />
                        </div>
                      )}
                      {/* معلومات المدرس */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent">
                        <h3 className="text-lg md:text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors duration-300">
                          {instructor.title}
                        </h3>
                      </div>
                    </div>

                    {/* محتوى البطاقة */}
                    <div className="p-4 md:p-6 flex-1 flex flex-col justify-between">
                      {/* إحصائيات سريعة */}
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-purple-500/10 to-purple-500/5 rounded-xl border border-purple-500/20">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                              <AcademicCapIcon className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="text-sm text-white/60">
                              عدد الفصول
                            </div>
                          </div>
                          <div className="font-bold text-white text-lg md:text-xl">
                            {instructorStats.chapters}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* تأثير التحليق */}
                    <div className="absolute inset-0 border-2 border-emerald-500/0 group-hover:border-emerald-500/30 rounded-2xl transition-all duration-500 pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UserFooter />
    </div>
  );
};

export default InstructorsPage;
