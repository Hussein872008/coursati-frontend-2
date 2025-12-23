import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminAPI, chapterAPI } from '../../../utils/api';

const AdminLectureRedirect = () => {
  const { lectureId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const highlight = q.get('highlight');
        const res = await adminAPI.getLectureByIdAdmin(lectureId);
        const lecture = res.data;
        if (!lecture) {
          navigate('/admin', { replace: true });
          return;
        }
        // lecture.chapterId may be populated object or id; normalize to id string
        const chapterId = lecture.chapterId && (lecture.chapterId._id || lecture.chapterId);
        if (!chapterId) { navigate('/admin', { replace: true }); return; }
        const chRes = await chapterAPI.getChapterById(chapterId);
        const chapter = chRes.data;
        if (!chapter) { navigate('/admin', { replace: true }); return; }
        // chapter.instructorId may be populated object or id
        const instructorId = (chapter.instructorId && (chapter.instructorId._id || chapter.instructorId)) || null;
        // materialId usually lives on instructor when populated
        const materialId = chapter.instructorId && chapter.instructorId.materialId
          ? (chapter.instructorId.materialId._id || chapter.instructorId.materialId)
          : chapter.materialId || null;
        // build full admin lecture path
        const path = `/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}/lectures/${lectureId}${highlight ? ('?highlight='+encodeURIComponent(highlight)) : ''}`;
        if (mounted) navigate(path);
      } catch (e) {
        navigate('/admin', { replace: true });
      }
    })();
    return () => { mounted = false; };
  }, [lectureId, navigate]);

  return <div className="p-6 text-white">جاري الانتقال إلى المحاضرة...</div>;
};

export default AdminLectureRedirect;
