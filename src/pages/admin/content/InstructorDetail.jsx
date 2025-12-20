import React, { useState, useEffect } from "react";
import useTitle from "../../../hooks/useTitle";
import { Link, useParams, useNavigate } from "react-router-dom";
import { instructorAPI, chapterAPI, lecturesAPI } from "../../../utils/api";
import AdminBreadcrumb from "../../../components/admin/AdminBreadcrumb";
import CloudinaryImageInput from "../../../components/CloudinaryImageInput";
import { validateAllNumericIds } from "../../../utils/routeValidation";
import { useFileUpload } from "../../../hooks/useFileUpload";

const InstructorDetail = () => {
  useTitle("كورساتي — تفاصيل المحاضر (إدارة)");
  const { materialId, instructorId } = useParams();
  const navigate = useNavigate();
  const [instructor, setInstructor] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [lecturesCount, setLecturesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ title: "", thumbnail: "" });
  const [showForm, setShowForm] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [activeTab, setActiveTab] = useState("chapters");
  const { uploadFile, loading: uploading } = useFileUpload("/chapters");
  const [editData, setEditData] = useState({ title: "", thumbnail: "" });
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  useEffect(() => {
    if (
      !validateAllNumericIds({ materialId, instructorId }, [
        "materialId",
        "instructorId",
      ])
    ) {
      navigate("/admin/content/materials");
      return;
    }
    loadData();
  }, [materialId, instructorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instructorRes, chaptersRes] = await Promise.all([
        instructorAPI.getInstructorById(instructorId),
        chapterAPI.getChaptersByInstructor(instructorId),
      ]);

      const instr = instructorRes.data || {};
      instr.thumbnail = instr.thumbnailUrl || instr.thumbnail;
      setInstructor(instr);
      setEditData({
        title: instr.title || "",
        thumbnail: instr.thumbnail || "",
      });

      const chData = chaptersRes.data || [];
      const normalized = chData.map((c) => ({
        ...c,
        thumbnail: c.thumbnailUrl || c.thumbnail,
      }));
      setChapters(normalized);
      // load lectures count across all chapters for this instructor
      try {
        if (normalized.length) {
          const lectureLists = await Promise.all(
            normalized.map((ch) =>
              lecturesAPI
                .getLecturesByChapter(ch._id)
                .then((r) => r.data || [])
                .catch(() => []),
            ),
          );
          const total = lectureLists.reduce(
            (sum, arr) => sum + (arr.length || 0),
            0,
          );
          setLecturesCount(total);
        } else {
          setLecturesCount(0);
        }
      } catch (err) {
        setLecturesCount(0);
      }
    } catch (error) {
      // Error loading data (handled by UI)
      navigate("/admin/content/materials");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (
        formData.thumbnail &&
        typeof formData.thumbnail === "object" &&
        formData.thumbnail instanceof File
      ) {
        const result = await uploadFile(formData.thumbnail, {
          title: formData.title,
          instructorId,
          order: 0,
        });

        if (result) {
          setFormData({ title: "", thumbnail: "" });
          setShowForm(false);
          await loadData();
        }
      } else {
        await chapterAPI.createChapter(
          formData.title,
          instructorId,
          formData.thumbnail || null,
          0,
        );
        setFormData({ title: "", thumbnail: "" });
        setShowForm(false);
        await loadData();
      }
    } catch (error) {
      // Error creating chapter (handled by UI)
    }
  };

  const handleDeleteInstructor = async () => {
    if (
      !window.confirm(
        `هل أنت متأكد من حذف المدرس "${instructor.title}" وجميع فصوله؟`,
      )
    )
      return;

    try {
      await instructorAPI.deleteInstructor(instructorId);
      navigate(`/admin/content/materials/${materialId}`);
    } catch (error) {
      // Error deleting instructor (handled by UI)
      alert("حدث خطأ أثناء حذف المدرس");
    }
  };

  if (loading && !instructor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-white/10 rounded w-1/4"></div>
          <div className="p-8 rounded-2xl bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10">
            <div className="flex items-center gap-6">
              <div className="h-32 w-32 bg-white/10 rounded-xl"></div>
              <div className="space-y-3 flex-1">
                <div className="h-8 bg-white/10 rounded w-1/3"></div>
                <div className="h-4 bg-white/10 rounded w-1/4"></div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 h-64"
              >
                <div className="flex gap-6">
                  <div className="w-32 h-32 bg-white/10 rounded-xl flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="h-6 bg-white/10 rounded mb-2 w-3/4"></div>
                    <div className="h-4 bg-white/10 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-red-500/20 to-pink-500/20 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-red-400"
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
          <h2 className="text-2xl font-bold text-white mb-2">
            المدرس غير موجود
          </h2>
          <p className="text-white/60 mb-6">
            المدرس الذي تبحث عنه غير موجود أو تم حذفه
          </p>
          <button
            onClick={() => navigate(`/admin/content/materials/${materialId}`)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            العودة إلى المدرسين
          </button>
        </div>
      </div>
    );
  }

  const breadcrumbs = [
    { label: "المواد", path: "/admin/content/materials" },
    { label: "المدرسين", path: `/admin/content/materials/${materialId}` },
    {
      label: instructor.title,
      path: `/admin/content/materials/${materialId}/instructors/${instructorId}`,
    },
  ];

  return (
    <div className="min-h-screen p-6">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <AdminBreadcrumb items={breadcrumbs} className="mb-3 -mt-2" />

        {/* Instructor Info Header */}
        <div className="admin-card p-8 mb-8 bg-gradient-to-r from-gray-800/60 via-gray-900/60 to-gray-800/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-6 mb-4 md:mb-0">
              {(instructor.thumbnailUrl || instructor.thumbnail) && (
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/10">
                  <img
                    src={instructor.thumbnailUrl || instructor.thumbnail}
                    alt={instructor.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                  {instructor.title}
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  المعرف: {instructor._id.slice(0, 8)}...
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-900/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="text-center px-4">
                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {chapters.length}
                </div>
                <div className="text-sm text-white/70">الفصول</div>
              </div>
              <div className="h-10 w-px bg-white/10"></div>
              <div className="text-center px-4">
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {lecturesCount}
                </div>
                <div className="text-sm text-white/70">المحاضرات</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-8">
          {/* Tabs Navigation */}
          <div className="admin-card p-2 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl">
            <div className="flex space-x-2 rtl:space-x-reverse">
              <button
                onClick={() => setActiveTab("chapters")}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === "chapters"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                الفصول ({chapters.length})
              </button>
              <button
                onClick={() => setActiveTab("details")}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === "details"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                التفاصيل
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === "settings"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                الإعدادات
              </button>
            </div>
          </div>

          {/* Chapters Tab */}
          {activeTab === "chapters" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chapters Cards - New Design (Right Image, Left Content) */}
                {chapters.map((chapter) => (
                  <Link
                    key={chapter._id}
                    to={`/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapter._id}`}
                    className="group relative"
                    onMouseEnter={() => setHoveredCard(chapter._id)}
                    onMouseLeave={() => setHoveredCard(null)}
                  >
                    {/* Glow Effect */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl blur-xl transition-opacity duration-500 ${
                        hoveredCard === chapter._id
                          ? "opacity-100"
                          : "opacity-0"
                      }`}
                    />

                    <div className="relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500">
                      <div className="flex gap-6 items-start">
                        {/* Content Left */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-semibold rounded-full shadow">
                              فصل
                            </span>
                            <span className="text-xs text-white/50">
                              #{chapter._id.slice(0, 8)}
                            </span>
                          </div>

                          <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors duration-300 line-clamp-2">
                            {chapter.title}
                          </h3>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                />
                              </svg>
                              <span>المعرف: {chapter._id}</span>
                            </div>
                          </div>

                          <div className="mt-6 flex items-center gap-3">
                            <span className="text-xs px-2 py-1 bg-white/10 text-white/80 rounded-lg">
                              انقر للمزيد
                            </span>
                            <svg
                              className="w-5 h-5 text-cyan-400 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                              />
                            </svg>
                          </div>
                        </div>

                        {/* Image Right */}
                        <div className="w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden border-2 border-white/10 group-hover:border-cyan-500/30 transition-colors duration-300">
                          {chapter.thumbnail ? (
                            <img
                              src={chapter.thumbnail}
                              alt={chapter.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-900/40 to-cyan-900/40 flex flex-col items-center justify-center">
                              <svg
                                className="w-10 h-10 text-white/30"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                />
                              </svg>
                              <span className="text-xs text-white/40 mt-2">
                                لا توجد صورة
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                {/* Add Chapter Card - Same layout as chapter cards */}
                <div
                  className={`group relative transition-all duration-500 ${
                    showForm ? "scale-[1.02]" : ""
                  }`}
                >
                  {/* Glow Effect for Add Card */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div
                    onClick={() => !showForm && setShowForm(true)}
                    className={`relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border ${
                      showForm
                        ? "border-emerald-500/50"
                        : "border-white/10 group-hover:border-emerald-500/30"
                    } rounded-2xl p-6 cursor-pointer transition-all duration-500 ${
                      !showForm &&
                      "hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1"
                    }`}
                  >
                    {!showForm ? (
                      <div className="flex gap-6 items-center">
                        {/* Content Left */}
                        <div className="flex-1">
                          <div className="mb-4">
                            <span className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold rounded-full shadow">
                              جديد
                            </span>
                          </div>

                          <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors duration-300">
                            إضافة فصل جديد
                          </h3>

                          <p className="text-white/60 text-sm mb-6">
                            أضف فصلاً جديداً لهذا المدرس
                          </p>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              <span className="text-sm font-medium">
                                انقر للبدء
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Icon Right */}
                        <div className="w-32 h-32 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border-2 border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors duration-300">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                            <svg
                              className="w-10 h-10 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-white">
                              إضافة فصل جديد
                            </h3>
                            <p className="text-white/60 text-sm mt-1">
                              املأ التفاصيل أدناه
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowForm(false);
                              setFormData({ title: "", thumbnail: "" });
                            }}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-300"
                          >
                            <svg
                              className="w-5 h-5 text-white/80"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSubmit(e);
                          }}
                          className="flex gap-6 items-center"
                        >
                          {/* Form Content Left */}
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-white/80 mb-1">
                                <span className="flex items-center gap-1.5">
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                    />
                                  </svg>
                                  عنوان الفصل
                                </span>
                              </label>
                              <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    title: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 text-sm bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder-white/40"
                                placeholder="أدخل عنوان الفصل..."
                                autoFocus
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={uploading || !formData.title.trim()}
                              className="px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 transition-all duration-200 font-medium w-full flex items-center justify-center gap-2"
                            >
                              {uploading ? (
                                <>
                                  <svg
                                    className="animate-spin h-4 w-4 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                  جاري الإضافة...
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                    />
                                  </svg>
                                  إضافة الفصل
                                </>
                              )}
                            </button>
                          </div>

                          {/* Image Preview Right */}
                          <div className="w-32 h-32 flex-shrink-0">
                            <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 relative flex flex-col">
                              {formData.thumbnail ? (
                                <>
                                  <img
                                    src={
                                      typeof formData.thumbnail === "string"
                                        ? formData.thumbnail
                                        : URL.createObjectURL(
                                            formData.thumbnail,
                                          )
                                    }
                                    alt="معاينة الصورة"
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFormData({
                                        ...formData,
                                        thumbnail: "",
                                      });
                                    }}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full transition-colors duration-200 backdrop-blur-sm border border-white/20"
                                    title="حذف الصورة"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                  <div className="absolute bottom-2 left-2 right-2">
                                    <label className="block cursor-pointer">
                                      <div className="px-2 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors duration-200 text-center backdrop-blur-sm border border-white/20">
                                        <CloudinaryImageInput
                                          value={formData.thumbnail}
                                          onChange={(url) =>
                                            setFormData({
                                              ...formData,
                                              thumbnail: url,
                                            })
                                          }
                                          compact={true}
                                          showLabel={false}
                                          buttonText="تغيير الصورة"
                                        />
                                      </div>
                                    </label>
                                  </div>
                                </>
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-900/40 to-cyan-900/40 flex flex-col items-center justify-center p-3">
                                  <div className="relative w-full h-full border-2 border-dashed border-white/30 rounded-lg hover:border-emerald-400/50 transition-colors duration-300 group">
                                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-2 group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-all duration-300">
                                        <svg
                                          className="w-5 h-5 text-white/60 group-hover:text-emerald-300 transition-colors duration-300"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                          />
                                        </svg>
                                      </div>
                                      <span className="text-xs text-white/50 group-hover:text-emerald-200 transition-colors duration-300 text-center px-2">
                                        انقر لرفع صورة
                                      </span>
                                      <div className="absolute opacity-0 w-0 h-0 overflow-hidden">
                                        <CloudinaryImageInput
                                          value={formData.thumbnail}
                                          onChange={(url) =>
                                            setFormData({
                                              ...formData,
                                              thumbnail: url,
                                            })
                                          }
                                          compact={true}
                                          showLabel={false}
                                        />
                                      </div>
                                    </label>
                                  </div>
                                  <span className="text-[10px] text-white/40 mt-2 text-center">
                                    PNG, JPG, GIF
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === "details" && (
            <div className="admin-card p-8 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <svg
                      className="w-6 h-6 text-cyan-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    معلومات المدرس
                  </h3>

                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 backdrop-blur-sm">
                      <div className="text-sm text-white/50 mb-1">
                        اسم المدرس
                      </div>
                      <div className="text-lg font-semibold text-white">
                        {instructor.title}
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-white/5 to-white/10 rounded-xl p-4 backdrop-blur-sm">
                      <div className="text-sm text-white/50 mb-1">
                        معرف المدرس
                      </div>
                      <div className="font-mono text-white/80 break-all">
                        {instructor._id}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <svg
                      className="w-6 h-6 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    إحصائيات
                  </h3>

                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border-l-4 border-cyan-400">
                      <div className="text-2xl font-bold text-cyan-300">
                        {chapters.length}
                      </div>
                      <div className="text-sm text-cyan-200">عدد الفصول</div>
                    </div>

                    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border-l-4 border-emerald-400">
                      <div className="text-2xl font-bold text-emerald-300">
                        {lecturesCount}
                      </div>
                      <div className="text-sm text-emerald-200">
                        المحاضرات المضافة
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="admin-card p-8 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-3xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                إعدادات المدرس
              </h3>

              <div className="space-y-6">
                {/* Edit Card */}
                <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-400/20 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex items-start gap-6">
                    <div className="w-28 h-28 rounded-xl overflow-hidden bg-white/5 border-2 border-white/10 flex items-center justify-center">
                      {editData.thumbnail ? (
                        <img
                          src={
                            typeof editData.thumbnail === "string"
                              ? editData.thumbnail
                              : ""
                          }
                          alt="thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/40">
                          <svg
                            className="w-8 h-8 mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span className="text-xs">صورة</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-amber-300">
                            تعديل معلومات المدرّس
                          </h4>
                          <p className="text-sm text-amber-200/80">
                            قم بتعديل اسم المدرّس وصورة العرض
                          </p>
                        </div>
                        <div>
                          {!editMode ? (
                            <button
                              onClick={() => setEditMode(true)}
                              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-md hover:shadow-blue-500/20 font-semibold"
                            >
                              تعديل
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditMode(false);
                                setEditData({
                                  title: instructor.title || "",
                                  thumbnail: instructor.thumbnail || "",
                                });
                                setEditSuccess(false);
                              }}
                              className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 font-semibold"
                            >
                              إلغاء
                            </button>
                          )}
                        </div>
                      </div>

                      {editMode && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setEditing(true);
                            try {
                              const res = await instructorAPI.updateInstructor(
                                instructorId,
                                editData.title,
                                editData.thumbnail || null,
                                instructor.order || 0,
                              );
                              setInstructor((prev) => ({
                                ...prev,
                                title: editData.title,
                                thumbnail: editData.thumbnail,
                              }));
                              setEditSuccess(true);
                              setEditMode(false);
                            } catch (err) {
                              // Error updating instructor (handled by UI)
                              alert("حدث خطأ أثناء تحديث بيانات المدرس");
                            } finally {
                              setEditing(false);
                            }
                          }}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-white/80 mb-2">
                                اسم المدرّس
                              </label>
                              <input
                                type="text"
                                value={editData.title}
                                onChange={(e) =>
                                  setEditData({
                                    ...editData,
                                    title: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-white/80 mb-2">
                                صورة العرض
                              </label>
                              <CloudinaryImageInput
                                value={editData.thumbnail}
                                onChange={(url) =>
                                  setEditData({ ...editData, thumbnail: url })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="submit"
                              disabled={editing}
                              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 font-semibold"
                            >
                              {editing ? "جاري الحفظ..." : "حفظ التغييرات"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditMode(false);
                                setEditData({
                                  title: instructor.title || "",
                                  thumbnail: instructor.thumbnail || "",
                                });
                              }}
                              className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                            >
                              إلغاء
                            </button>
                            {editSuccess && (
                              <span className="text-sm text-emerald-300 flex items-center gap-1">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                تم الحفظ بنجاح
                              </span>
                            )}
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-400/20 rounded-2xl p-6 backdrop-blur-sm">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-bold text-red-300 mb-2">
                        منطقة الخطر
                      </h4>
                      <p className="text-red-200/80">
                        حذف هذا المدرس سيزيل جميع الفصول والدروس المرتبطة به
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteInstructor}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg hover:shadow-red-500/20 transform hover:-translate-y-0.5 transition-all duration-200 font-semibold whitespace-nowrap"
                    >
                      حذف المدرس
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorDetail;
