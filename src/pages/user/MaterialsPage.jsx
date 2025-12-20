import React, { useState, useEffect } from "react";
import useTitle from "../../hooks/useTitle";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { materialAPI } from "../../utils/api";
import UserHeader from "../../components/user/UserHeader";
import UserFooter from "../../components/user/UserFooter";
import {
  AcademicCapIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  SparklesIcon,
  FireIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
  BookOpenIcon as BookOpenSolid,
  FireIcon as FireSolid,
} from "@heroicons/react/24/solid";

const MaterialsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  useTitle("كورساتي — المواد");
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [hoveredCard, setHoveredCard] = useState(null);
  const [stats, setStats] = useState({
    totalMaterials: 0,
    totalLectures: 0,
    totalVideos: 0,
    totalPDFs: 0,
    activeUsers: 0,
  });

  useEffect(() => {
    loadMaterials();
    loadStats();
  }, []);

  const handleCardKeyDown = (e, materialId) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      handleMaterialClick(materialId);
    }
  };

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await materialAPI.getAllMaterials();
      setMaterials(response.data || []);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadStats = async () => {
    // في الواقع، هذه البيانات ستأتي من API
    setStats({
      totalMaterials: 24,
      totalLectures: 156,
      totalVideos: 320,
      totalPDFs: 89,
      activeUsers: 1248,
    });
  };

  const handleMaterialClick = (materialId) => {
    navigate(`/material/${materialId}`);
  };

  // لا تصفية - عرض جميع المواد
  const filteredMaterials = materials;

  const getMaterialStats = (material) => {
    // استخدام البيانات الحقيقية من Backend
    return {
      teachers: material.instructorsCount || 0,
    };
  };

  const renderStatsCard = (icon, label, value, color) => (
    <div
      className={`p-4 rounded-xl bg-gradient-to-br ${color} border border-white/10 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-white/80 text-sm mt-1">{label}</div>
        </div>
        <div className="p-2 bg-white/20 rounded-lg">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-white/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/80 text-lg">جاري تحميل المكتبة...</p>
          <p className="text-white/60 text-sm mt-2">
            جاري تحميل المواد التعليمية
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen " dir="rtl">
      {/* شريط التنقل العلوي */}
      <UserHeader showBackButton={false} />

      {/* المحتوى الرئيسي */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 p-6">
        {/* رأس الصفحة */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 md:p-3 rounded-xl ">
              <BookOpenSolid className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                المكتبة التعليمية
              </h1>
              <p className="text-white/70">اختر مادة لبدء رحلة التعلم</p>
            </div>
          </div>
        </div>

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

        {/* بطاقات المواد */}
        {filteredMaterials.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 rounded-full  border-2 border-dashed border-white/20 flex items-center justify-center mx-auto mb-6">
              <BookOpenIcon className="w-12 h-12 text-white/40" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              لا توجد مواد متاحة
            </h3>
            <p className="text-white/60 mb-8">لم يتم العثور على مواد</p>
            <button
              onClick={() => {
                loadMaterials();
              }}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all duration-300"
            >
              تحديث المواد
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMaterials.map((material) => {
              const materialStats = getMaterialStats(material);
              const isHovered = hoveredCard === material._id;

              return (
                <div
                  key={material._id}
                  className="group relative"
                  onMouseEnter={() => setHoveredCard(material._id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => handleMaterialClick(material._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => handleCardKeyDown(e, material._id)}
                >
                  {/* تأثير اللمعان */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl blur-xl transition-opacity duration-500 ${isHovered ? "opacity-100" : "opacity-0"}`}
                  />

                  {/* البطاقة الرئيسية */}
                  <div className="relative bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 cursor-pointer transform hover:-translate-y-2 h-full flex flex-col">
                    {/* صورة المادة */}
                    <div className="h-40 md:h-56 overflow-hidden relative flex-shrink-0">
                      {material.thumbnailUrl ? (
                        <>
                          <img
                            src={material.thumbnailUrl}
                            alt={material.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                          <BookOpenIcon className="w-16 h-16 text-white/30" />
                          <span className="text-white/40 mt-2">
                            لا توجد صورة
                          </span>
                        </div>
                      )}
                    </div>

                    {/* محتوى البطاقة المبسط */}
                    <div className="p-4 md:p-5 flex-1 flex flex-col">
                      {/* عنوان المادة */}
                      <h3 className="text-lg md:text-xl font-bold text-white mb-4 group-hover:text-cyan-300 transition-colors duration-300 text-center">
                        {material.title}
                      </h3>
                      {/* عدد المدرسين */}
                      <div className="mt-auto flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <UserGroupIcon className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm text-white/60">
                            عدد المدرسين
                          </span>
                        </div>
                        <span className="font-bold text-white text-lg md:text-xl">
                          {materialStats.teachers}
                        </span>
                      </div>
                    </div>

                    {/* تأثير التحليق */}
                    <div className="absolute inset-0 border-2 border-cyan-500/0 group-hover:border-cyan-500/30 rounded-2xl transition-all duration-500 pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* فوتر */}
      <UserFooter />
    </div>
  );
};

export default MaterialsPage;
