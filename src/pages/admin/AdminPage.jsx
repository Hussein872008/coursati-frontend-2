import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  authAPI,
  materialAPI,
  instructorAPI,
  chapterAPI,
  lecturesAPI,
  pdfsAPI,
} from "../../utils/api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/useAuth";
import useTitle from "../../hooks/useTitle";
import FileUploadWidget from "../../components/FileUploadWidget";

const AdminPage = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  useTitle("كورساتي — الإدارة");
  const [view, setView] = useState("users");
  const [users, setUsers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Form states
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newMaterialTitle, setNewMaterialTitle] = useState("");
  const [newMaterialThumbnail, setNewMaterialThumbnail] = useState("");
  const [newInstructorTitle, setNewInstructorTitle] = useState("");
  const [newInstructorThumbnail, setNewInstructorThumbnail] = useState("");
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterThumbnail, setNewChapterThumbnail] = useState("");
  const [newLectureTitle, setNewLectureTitle] = useState("");
  // Video states removed - video functionality has been removed from the project
  const [newPdfTitle, setNewPdfTitle] = useState("");
  const [newPdfUrl, setNewPdfUrl] = useState("");
  // Creating states for form submit buttons
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingMaterial, setCreatingMaterial] = useState(false);
  const [creatingInstructor, setCreatingInstructor] = useState(false);
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [creatingLecture, setCreatingLecture] = useState(false);
  const [creatingPdf, setCreatingPdf] = useState(false);

  useEffect(() => {
    loadUsers();
    loadMaterials();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await authAPI.getAllUsers();
      setUsers(response.data);
    } catch (error) {
      alert("خطأ في تحميل المستخدمين");
    }
  };

  const loadMaterials = async () => {
    try {
      const response = await materialAPI.getAllMaterials();
      const materialsWithInstructors = await Promise.all(
        response.data.map(async (material) => {
          try {
            const instructorsRes = await instructorAPI.getInstructorsByMaterial(
              material._id,
            );
            const instructorsWithChapters = await Promise.all(
              instructorsRes.data.map(async (instructor) => {
                try {
                  const chaptersRes = await chapterAPI.getChaptersByInstructor(
                    instructor._id,
                  );
                  const chaptersWithLectures = await Promise.all(
                    chaptersRes.data.map(async (chapter) => {
                      try {
                        const lecturesRes =
                          await lecturesAPI.getLecturesByChapter(chapter._id);
                        return {
                          ...chapter,
                          lectures: lecturesRes.data || [],
                        };
                      } catch {
                        return {
                          ...chapter,
                          lectures: [],
                        };
                      }
                    }),
                  );

                  return {
                    ...instructor,
                    chapters: chaptersWithLectures,
                  };
                } catch {
                  return {
                    ...instructor,
                    chapters: [],
                  };
                }
              }),
            );

            return {
              ...material,
              instructors: instructorsWithChapters,
            };
          } catch {
            return {
              ...material,
              instructors: [],
            };
          }
        }),
      );

      setMaterials(materialsWithInstructors);
    } catch (error) {
      alert("خطأ في تحميل المواد");
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      await authAPI.createUser(newUserName, newUserPhone);
      setNewUserName("");
      setNewUserPhone("");
      alert("تم إنشاء المستخدم بنجاح");
      await loadUsers();
    } catch (error) {
      alert("خطأ في إنشاء المستخدم");
    } finally {
      setCreatingUser(false);
    }
  };

  const createMaterial = async (e) => {
    e.preventDefault();
    setCreatingMaterial(true);
    try {
      await materialAPI.createMaterial(
        newMaterialTitle,
        newMaterialThumbnail,
        0,
      );
      setNewMaterialTitle("");
      setNewMaterialThumbnail("");
      alert("تم إنشاء المادة بنجاح");
      await loadMaterials();
      try {
        await queryClient.invalidateQueries(["materials"]);
      } catch (e) {
        // ignore
      }
    } catch (error) {
      alert("خطأ في إنشاء المادة");
    } finally {
      setCreatingMaterial(false);
    }
  };

  const createInstructor = async (e) => {
    e.preventDefault();
    if (!selectedMaterial) {
      alert("اختر مادة أولاً");
      return;
    }
    setCreatingInstructor(true);
    try {
      await instructorAPI.createInstructor(
        newInstructorTitle,
        selectedMaterial._id,
        newInstructorThumbnail,
        0,
      );
      setNewInstructorTitle("");
      setNewInstructorThumbnail("");
      alert("تم إنشاء المدرس بنجاح");
      const instructorsRes = await instructorAPI.getInstructorsByMaterial(
        selectedMaterial._id,
      );
      setSelectedMaterial({
        ...selectedMaterial,
        instructors: instructorsRes.data,
      });
    } catch (error) {
      alert("خطأ في إنشاء المدرس");
    } finally {
      setCreatingInstructor(false);
    }
  };

  const createChapter = async (e) => {
    e.preventDefault();
    if (!selectedInstructor) {
      alert("اختر مدرساً أولاً");
      return;
    }
    setCreatingChapter(true);
    try {
      await chapterAPI.createChapter(
        newChapterTitle,
        selectedInstructor._id,
        newChapterThumbnail,
        0,
      );
      setNewChapterTitle("");
      setNewChapterThumbnail("");
      alert("تم إنشاء الفصل بنجاح");
      const chaptersRes = await chapterAPI.getChaptersByInstructor(
        selectedInstructor._id,
      );
      const updatedInstructor = {
        ...selectedInstructor,
        chapters: chaptersRes.data,
      };
      setSelectedInstructor(updatedInstructor);

      const updatedMaterials = materials.map((mat) => ({
        ...mat,
        instructors: mat.instructors.map((inst) =>
          inst._id === selectedInstructor._id ? updatedInstructor : inst,
        ),
      }));
      setMaterials(updatedMaterials);
    } catch (error) {
      alert("خطأ في إنشاء الفصل");
    } finally {
      setCreatingChapter(false);
    }
  };

  const createLecture = async (e) => {
    e.preventDefault();
    if (!selectedChapter) {
      alert("اختر فصلاً أولاً");
      return;
    }
    setCreatingLecture(true);
    try {
      await lecturesAPI.createLecture(
        newLectureTitle,
        selectedChapter._id,
        null,
        0,
      );
      setNewLectureTitle("");
      alert("تم إنشاء المحاضرة بنجاح");
      const lecturesRes = await lecturesAPI.getLecturesByChapter(
        selectedChapter._id,
      );
      const updatedChapter = {
        ...selectedChapter,
        lectures: lecturesRes.data,
      };
      setSelectedChapter(updatedChapter);

      const updatedInstructor = {
        ...selectedInstructor,
        chapters: selectedInstructor.chapters.map((ch) =>
          ch._id === selectedChapter._id ? updatedChapter : ch,
        ),
      };
      setSelectedInstructor(updatedInstructor);

      const updatedMaterials = materials.map((mat) => ({
        ...mat,
        instructors: mat.instructors.map((inst) =>
          inst._id === selectedInstructor._id ? updatedInstructor : inst,
        ),
      }));
      setMaterials(updatedMaterials);
    } catch (error) {
      alert("خطأ في إنشاء المحاضرة");
    } finally {
      setCreatingLecture(false);
    }
  };

  // Video creation removed - video functionality has been removed from the project

  const createPdf = async (e) => {
    e.preventDefault();
    if (!selectedLecture) {
      alert("اختر محاضرة أولاً");
      return;
    }
    setCreatingPdf(true);
    try {
      await pdfsAPI.createPDF(newPdfTitle, selectedLecture._id, newPdfUrl, 0);
      setNewPdfTitle("");
      setNewPdfUrl("");
      alert("تم إضافة الملف بنجاح");
      await loadMaterials();
    } catch (error) {
      alert("خطأ في إضافة الملف");
    } finally {
      setCreatingPdf(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-transparent" dir="rtl">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">لوحة التحكم</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
          >
            تسجيل خروج
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { id: "users", label: "المستخدمين" },
            { id: "materials", label: "المواد" },
            { id: "structure", label: "الهيكل" },
            { id: "content", label: "المحتوى" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`py-2 px-4 rounded font-semibold transition ${
                view === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-800 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users View */}
        {view === "users" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">إنشاء مستخدم جديد</h2>
              <form onSubmit={createUser} className="space-y-4">
                <input
                  type="text"
                  placeholder="الاسم"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-4 py-2 border rounded"
                  required
                />
                <input
                  type="text"
                  placeholder="الهاتف"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  className="w-full px-4 py-2 border rounded"
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-60"
                  disabled={creatingUser}
                >
                  {creatingUser ? "جارٍ الإنشاء..." : "إنشاء مستخدم"}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">قائمة المستخدمين</h2>
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user._id}
                    className="p-4 border rounded hover:bg-gray-50"
                  >
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-sm text-gray-600">
                      الكود: {user.code} • الهاتف: {user.phone}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Materials View */}
        {view === "materials" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">إنشاء مادة</h2>
              <form onSubmit={createMaterial} className="space-y-4">
                <input
                  type="text"
                  placeholder="اسم المادة"
                  value={newMaterialTitle}
                  onChange={(e) => setNewMaterialTitle(e.target.value)}
                  className="w-full px-4 py-2 border rounded"
                  required
                />

                <div>
                  <label className="block text-sm font-medium mb-2">
                    صورة المادة:
                  </label>
                  <div className="flex gap-4 items-center">
                    <FileUploadWidget
                      onSuccess={(url) => setNewMaterialThumbnail(url)}
                      onError={(err) => alert("خطأ: " + err)}
                    />
                    {newMaterialThumbnail && (
                      <div className="flex items-center gap-2">
                        <img
                          src={newMaterialThumbnail}
                          alt="معاينة"
                          className="w-16 h-16 object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => setNewMaterialThumbnail("")}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          ❌ إزالة
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-60"
                  disabled={creatingMaterial}
                >
                  {creatingMaterial ? "جارٍ الإنشاء..." : "إنشاء مادة"}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">قائمة المواد</h2>
              <div className="space-y-2">
                {materials.map((material) => (
                  <button
                    key={material._id}
                    onClick={() => setSelectedMaterial(material)}
                    className={`w-full text-right p-4 border rounded transition ${
                      selectedMaterial?._id === material._id
                        ? "bg-blue-100 border-blue-500"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {material.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Structure View */}
        {view === "structure" && (
          <div className="space-y-6">
            {/* Instructors */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">إنشاء مدرس</h2>
              <form onSubmit={createInstructor} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    المادة المختارة: {selectedMaterial?.title || "لم تختر"}
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="اسم المدرس"
                  value={newInstructorTitle}
                  onChange={(e) => setNewInstructorTitle(e.target.value)}
                  className="w-full px-4 py-2 border rounded"
                  required
                />

                <div>
                  <label className="block text-sm font-medium mb-2">
                    صورة المدرس:
                  </label>
                  <div className="flex gap-4 items-center">
                    <FileUploadWidget
                      onSuccess={(url) => setNewInstructorThumbnail(url)}
                      onError={(err) => alert("خطأ: " + err)}
                    />
                    {newInstructorThumbnail && (
                      <div className="flex items-center gap-2">
                        <img
                          src={newInstructorThumbnail}
                          alt="معاينة"
                          className="w-16 h-16 object-cover rounded-full"
                        />
                        <button
                          type="button"
                          onClick={() => setNewInstructorThumbnail("")}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          ❌ إزالة
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-60"
                  disabled={!selectedMaterial || creatingInstructor}
                >
                  {creatingInstructor ? "جارٍ الإنشاء..." : "إنشاء مدرس"}
                </button>
              </form>
            </div>

            {/* Chapters */}
            {selectedMaterial && (
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">إنشاء فصل</h2>
                <form onSubmit={createChapter} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      المدرس المختار: {selectedInstructor?.title || "لم تختر"}
                    </label>
                  </div>
                  <input
                    type="text"
                    placeholder="اسم الفصل"
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    className="w-full px-4 py-2 border rounded"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      صورة الفصل:
                    </label>
                    <div className="flex gap-4 items-center">
                      <FileUploadWidget
                        onSuccess={(url) => setNewChapterThumbnail(url)}
                        onError={(err) => alert("خطأ: " + err)}
                      />
                      {newChapterThumbnail && (
                        <div className="flex items-center gap-2">
                          <img
                            src={newChapterThumbnail}
                            alt="معاينة"
                            className="w-16 h-16 object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={() => setNewChapterThumbnail("")}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            ❌ إزالة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-60"
                    disabled={!selectedInstructor || creatingChapter}
                  >
                    {creatingChapter ? "جارٍ الإنشاء..." : "إنشاء فصل"}
                  </button>
                </form>

                <div className="mt-6">
                  <h3 className="font-semibold mb-3">المدرسين</h3>
                  <div className="space-y-2">
                    {selectedMaterial.instructors?.map((instructor) => (
                      <button
                        key={instructor._id}
                        onClick={() => setSelectedInstructor(instructor)}
                        className={`w-full text-right p-4 border rounded transition ${
                          selectedInstructor?._id === instructor._id
                            ? "bg-blue-100 border-blue-500"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {instructor.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content View */}
        {view === "content" && (
          <div className="space-y-6">
            {/* Lectures */}
            {selectedChapter && (
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">إنشاء محاضرة</h2>
                <form onSubmit={createLecture} className="space-y-4">
                  <input
                    type="text"
                    placeholder="اسم المحاضرة"
                    value={newLectureTitle}
                    onChange={(e) => setNewLectureTitle(e.target.value)}
                    className="w-full px-4 py-2 border rounded"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-60"
                    disabled={creatingLecture}
                  >
                    {creatingLecture ? "جارٍ الإنشاء..." : "إنشاء محاضرة"}
                  </button>
                </form>
              </div>
            )}

            {/* Videos */}
            {selectedLecture && (
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">إضافة فيديو</h2>
                <form onSubmit={createVideo} className="space-y-4">
                  <input
                    type="text"
                    placeholder="اسم الفيديو"
                    value={newVideoTitle}
                    onChange={(e) => setNewVideoTitle(e.target.value)}
                    className="w-full px-4 py-2 border rounded"
                    required
                  />
                  <input
                    type="text"
                    placeholder="رابط القطعة (مثال: https://example.com/segment-2778-v1-a1.ts)"
                    value={newVideoSegmentUrl}
                    onChange={(e) => setNewVideoSegmentUrl(e.target.value)}
                    className="w-full px-4 py-2 border rounded"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
                  >
                    إضافة فيديو
                  </button>
                </form>
              </div>
            )}

            {/* PDFs */}
            {selectedLecture && (
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">إضافة ملف PDF</h2>
                <form onSubmit={createPdf} className="space-y-4">
                  <input
                    type="text"
                    placeholder="اسم الملف"
                    value={newPdfTitle}
                    onChange={(e) => setNewPdfTitle(e.target.value)}
                    className="w-full px-4 py-2 border rounded"
                    required
                  />
                  <input
                    type="text"
                    placeholder="رابط ملف PDF"
                    value={newPdfUrl}
                    onChange={(e) => setNewPdfUrl(e.target.value)}
                    className="w-full px-4 py-2 border rounded"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-60"
                    disabled={!selectedLecture || creatingPdf}
                  >
                    {creatingPdf ? "جارٍ الإضافة..." : "إضافة ملف PDF"}
                  </button>
                </form>
              </div>
            )}

            {/* Chapter selector */}
            {selectedInstructor && (
              <div className="bg-white rounded-lg p-6">
                <h3 className="font-semibold mb-3">الفصول</h3>
                <div className="space-y-2">
                  {selectedInstructor.chapters?.map((chapter) => (
                    <button
                      key={chapter._id}
                      onClick={() => setSelectedChapter(chapter)}
                      className={`w-full text-right p-4 border rounded transition ${
                        selectedChapter?._id === chapter._id
                          ? "bg-blue-100 border-blue-500"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {chapter.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lecture selector */}
            {selectedChapter && (
              <div className="bg-white rounded-lg p-6">
                <h3 className="font-semibold mb-3">المحاضرات</h3>
                <div className="space-y-2">
                  {selectedChapter.lectures?.map((lecture) => (
                    <button
                      key={lecture._id}
                      onClick={() => setSelectedLecture(lecture)}
                      className={`w-full text-right p-4 border rounded transition ${
                        selectedLecture?._id === lecture._id
                          ? "bg-blue-100 border-blue-500"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {lecture.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
