import React, { useState, useEffect } from 'react';
import useTitle from '../../../hooks/useTitle';
import { Link } from 'react-router-dom';
import { materialAPI, adminAPI } from '../../../utils/api';
import { useFileUpload } from '../../../hooks/useFileUpload';
import AdminBreadcrumb from '../../../components/admin/AdminBreadcrumb';
import CloudinaryImageInput from '../../../components/CloudinaryImageInput';

const MaterialsList = () => {
  useTitle('كورساتي — المواد (إدارة)');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lectureCount, setLectureCount] = useState(0);
  const [formData, setFormData] = useState({ title: '', thumbnail: '' });
  const [showForm, setShowForm] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const { uploadFile, loading: uploading, error: uploadError } = useFileUpload('/materials');

  useEffect(() => {
    loadMaterials();
    loadAdminStats();
  }, []);

  const loadAdminStats = async () => {
    try {
      const res = await adminAPI.getStats();
      const totals = res?.data?.totals;
      if (totals && typeof totals.lectures !== 'undefined') setLectureCount(totals.lectures);
    } catch (e) {
      // ignore
    }
  };

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const response = await materialAPI.getAllMaterials();
      setMaterials(response.data || []);
    } catch (error) {
      // Error loading materials (handled by UI)
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      // If thumbnail is a File (selected from input), upload via FormData endpoint
      if (formData.thumbnail && typeof formData.thumbnail === 'object' && formData.thumbnail instanceof File) {
        const result = await uploadFile(formData.thumbnail, { title: formData.title, order: 0 });
        if (result) {
          setFormData({ title: '', thumbnail: '' });
          setShowForm(false);
          await loadMaterials();
        } else {
          // Upload failed (handled by UI)
        }
      } else {
        // thumbnail is probably a URL (string) or empty
        await materialAPI.createMaterial(formData.title, formData.thumbnail || null, 0);
        setFormData({ title: '', thumbnail: '' });
        setShowForm(false);
        await loadMaterials();
      }
    } catch (error) {
      // Error creating material (handled by UI)
    }
  };

  const breadcrumbs = [
    { label: 'المواد', path: '/admin/content/materials' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <AdminBreadcrumb items={breadcrumbs} className="mb-3 -mt-2" />

        {/* Header */}
        <div className="admin-card p-2 md:p-8 mb-8 bg-gradient-to-r from-gray-800/60 via-gray-900/60 to-gray-800/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                إدارة المواد التعليمية
              </h1>
              <p className="text-white/70 text-sm mt-2">قم بإدارة المواد التعليمية والمحتوى الرقمي</p>
            </div>

            <div className="flex items-center gap-4 bg-gray-900/40 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
              <div className="text-center px-4">
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {materials.length}
                </div>
                <div className="text-sm text-white/70">المواد</div>
              </div>
              <div className="h-10 w-px bg-white/10"></div>
              <div className="text-center px-4">
                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {lectureCount}
                </div>
                <div className="text-sm text-white/70">المحاضرات</div>
              </div>
            </div>
          </div>
        </div>

        {/* Materials Grid with Enhanced Design */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">المكتبة التعليمية</h2>
              <p className="text-white/60">
                جميع المواد التعليمية المتاحة ({materials.length})
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-6 rounded-2xl bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 animate-pulse">
                  <div className="flex gap-6">
                    <div className="w-32 h-32 bg-gray-700 rounded-xl flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="h-8 bg-gray-700 rounded mb-4 w-3/4"></div>
                      <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {/* Existing Materials in Card Layout (Image Right, Content Left) */}
              {materials.map((material) => (
                <Link
                  key={material._id}
                  to={`/admin/content/materials/${material._id}`}
                  className="group relative block w-full"
                  onMouseEnter={() => setHoveredCard(material._id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* Glow Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl blur-xl transition-opacity duration-500 ${hoveredCard === material._id ? 'opacity-100' : 'opacity-0'
                    }`} />

                  <div className="relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border border-white/10 rounded-2xl p-4 md:p-6 hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 w-full">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                      {/* Content Left */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold rounded-full shadow">
                            مادة
                          </span>
                          <span className="text-xs text-white/50">#{material._id.slice(0, 8)}</span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-300 transition-colors duration-300 line-clamp-1">
                          {material.title}
                        </h3>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-white/60">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            <span>المعرف: {material._id}</span>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-white/60">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>تم الإنشاء: {new Date(material.createdAt).toLocaleDateString('ar-SA')}</span>
                          </div>
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                          <span className="text-xs px-2 py-1 bg-white/10 text-white/80 rounded-lg">
                            انقر للمزيد
                          </span>
                          <svg className="w-5 h-5 text-cyan-400 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                      </div>

                      {/* Image Right (stacks on small screens) */}
                      <div className="w-full md:w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden border-2 border-white/10 group-hover:border-cyan-500/30 transition-colors duration-300 mx-auto md:mx-0">
                        {(material.thumbnailUrl || material.thumbnail) ? (
                          <img
                            src={material.thumbnailUrl || material.thumbnail}
                            alt={material.title}
                            className="w-full h-full object-cover transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center">
                            <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs text-white/40 mt-2">لا توجد صورة</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Add Material Card - Match material card size and layout */}
              <div className={`group relative transition-all duration-500 w-full ${showForm ? 'scale-[1.02]' : ''}`}>
                {/* Glow Effect for Add Card (matches material cards) */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div
                  onClick={() => !showForm && setShowForm(true)}
                  className={`relative bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm border ${showForm ? 'border-emerald-500/50' : 'border-white/10 group-hover:border-emerald-500/30'
                    } rounded-2xl p-4 md:p-6 cursor-pointer transition-all duration-500 w-full ${!showForm && 'hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1'}`}
                >
                  {!showForm ? (
                      <div className="flex flex-col md:flex-row gap-6 items-start">
                      {/* Content Left */}
                      <div className="flex-1">
                        <div className="mb-3">
                          <span className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold rounded-full shadow">
                            جديد
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-300 transition-colors duration-300">
                          إضافة مادة جديدة
                        </h3>

                        <p className="text-white/60 text-sm mb-4">
                          أضف مادة تعليمية جديدة إلى المكتبة
                        </p>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="text-xs font-medium">انقر للبدء</span>
                          </div>
                        </div>
                      </div>

                      {/* Icon Right - match size to material cards image */}
                      <div className="w-32 h-32 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border-2 border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/40 transition-colors duration-300">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white">إنشاء مادة جديدة</h3>
                          <p className="text-white/60 text-sm mt-1">املأ التفاصيل أدناه</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowForm(false);
                            setFormData({ title: '', thumbnail: '' });
                          }}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-300"
                        >
                          <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSubmit(e);
                        }}
                        className="flex flex-col md:flex-row gap-4 md:gap-6 items-start"
                      >
                        {/* Form Content Left - use flex-1 so card height matches */}
                        <div className="flex-1 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-1">
                              <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                اسم المادة
                              </span>
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.title}
                              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                              className="w-full px-3 py-2 text-sm bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder-white/40"
                              placeholder="أدخل اسم المادة..."
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
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                جاري الإضافة...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                إضافة المادة
                              </>
                            )}
                          </button>
                        </div>

                        {/* Image Preview Right - stacks on small screens */}
                        <div className="w-full md:w-32 h-32 flex-shrink-0 mx-auto md:mx-0 mt-2 md:mt-0">
                          <div className="w-full h-full rounded-xl overflow-hidden border border-white/10 relative flex flex-col">
                            {formData.thumbnail ? (
                              // حالة وجود صورة - عرض المعاينة مع زر الحذف
                              <>
                                <img
                                  src={typeof formData.thumbnail === 'string' ? formData.thumbnail : URL.createObjectURL(formData.thumbnail)}
                                  alt="معاينة الصورة"
                                  className="w-full h-full object-cover"
                                />
                                {/* زر الحذف - أعلى يمين الصورة */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData({ ...formData, thumbnail: '' });
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full transition-colors duration-200 backdrop-blur-sm border border-white/20"
                                  title="حذف الصورة"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>

                                {/* زر تغيير الصورة - أسفل الصورة */}
                                <div className="absolute bottom-2 left-2 right-2">
                                  <label className="block cursor-pointer">
                                    <div className="px-2 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors duration-200 text-center backdrop-blur-sm border border-white/20">
                                      <CloudinaryImageInput
                                        value={formData.thumbnail}
                                        onChange={(url) => setFormData({ ...formData, thumbnail: url })}
                                        compact={true}
                                        showLabel={false}
                                        buttonText="تغيير الصورة"
                                      />
                                    </div>
                                  </label>
                                </div>
                              </>
                            ) : (
                              // حالة عدم وجود صورة - عرض مربع الرفع
                              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center p-3">
                                <div className="relative w-full h-full border-2 border-dashed border-white/30 rounded-lg hover:border-emerald-400/50 transition-colors duration-300 group">
                                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                                    {/* أيقونة رفع الصورة */}
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-2 group-hover:from-emerald-500/30 group-hover:to-teal-500/30 transition-all duration-300">
                                      <svg className="w-5 h-5 text-white/60 group-hover:text-emerald-300 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>

                                    {/* نص الإرشاد */}
                                    <span className="text-xs text-white/50 group-hover:text-emerald-200 transition-colors duration-300 text-center px-2">
                                      انقر لرفع صورة
                                    </span>

                                    {/* مكون CloudinaryImageInput مخفي */}
                                    <div className="absolute opacity-0 w-0 h-0 overflow-hidden">
                                      <CloudinaryImageInput
                                        value={formData.thumbnail}
                                        onChange={(url) => setFormData({ ...formData, thumbnail: url })}
                                        compact={true}
                                        showLabel={false}
                                      />
                                    </div>
                                  </label>
                                </div>

                                {/* نص إضافي */}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialsList;