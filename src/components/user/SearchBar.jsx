import React, { useState, useRef, useEffect, startTransition } from 'react';
import useGlobalSearch from '../../hooks/useGlobalSearch';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const GroupTitle = ({ children }) => (
  <div className="px-3 py-1 text-xs text-white/60">{children}</div>
);

export default function SearchBar() {
  const { query, setQuery, results, loading, clear } = useGlobalSearch('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    if (query && query.trim() !== '') setOpen(true);
  }, [query]);

  const handleClick = (item) => {
    // Wrap navigation and closing in a transition to avoid "suspended while responding to input" errors
    startTransition(() => {
      setOpen(false);
      if (item.type === 'chapter') navigate(`/chapter/${item._id}`);
      else if (item.type === 'material') navigate(`/material/${item._id}`);
      else if (item.type === 'lecture') {
        const chapterId = item.chapterId || '';
        navigate(`/chapter/${chapterId}/lecture/${item._id}`);
      } else if (item.type === 'pdf') {
        const chapterId = item.chapterId || '';
        const lectureId = item.lectureId || '';
        navigate(`/chapter/${chapterId}/lecture/${lectureId}`);
      } else if (item.type === 'video') {
        const chapterId = item.chapterId || '';
        const lectureId = item.lectureId || '';
        navigate(`/chapter/${chapterId}/lecture/${lectureId}`);
      } else if (item.type === 'instructor') {
        navigate(`/instructor/${item._id}`);
      } else {
        navigate('/');
      }
    });
  };

  const renderList = () => {
    if (!results) return null;
    const groups = [
      { key: 'chapters', label: 'فصول' },
      { key: 'lectures', label: 'محاضرات' },
      { key: 'materials', label: 'مواد' },
      { key: 'instructors', label: 'مدرسين' },
      { key: 'pdfs', label: 'ملفات PDF' },
      { key: 'videos', label: 'فيديوهات' },
    ];

    return groups.map((g) => {
      const arr = results[g.key] || [];
      if (!arr.length) return null;
      return (
        <div key={g.key} className="border-t border-white/5">
          <GroupTitle>{g.label}</GroupTitle>
          {arr.map((it) => (
            <button
              key={it._id}
              onClick={() => handleClick(it)}
              className="w-full text-right px-3 py-2 hover:bg-white/5 text-white flex items-center gap-2"
            >
              <div className="flex items-center gap-3 truncate">
                {it.thumbnailUrl ? (
                  <img src={it.thumbnailUrl} alt="thumb" className="w-12 h-8 object-cover rounded-md" />
                ) : (
                  <div className="w-12 h-8 bg-white/5 rounded-md flex items-center justify-center text-white/40 text-xs">لا صورة</div>
                )}

                <div className="text-right truncate">
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-[12px] text-white/60 truncate">{it.subtitle || ''}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      );
    });
  };

  return (
    <div ref={ref} className="relative w-full max-w-xl lg:max-w-2xl">
      <div className="flex items-center bg-white/5 rounded-xl px-2 py-1 gap-2">
        <MagnifyingGlassIcon className="w-5 h-5 text-white/60" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="ابحث في المحتوى..."
          className="bg-transparent w-full text-white placeholder-white/50 outline-none"
        />
        {query && (
          <button
            onClick={() => { clear(); setOpen(false); }}
            className="text-white/60 px-2"
            aria-label="clear"
          >
            مسح
          </button>
        )}
      </div>

      {open && (
        <div className="fixed left-0 right-0 top-16 z-50 flex justify-center">
          <div className="w-full max-w-7xl px-3 sm:px-6">
            <div className="w-full max-h-96 overflow-auto bg-gray-800/95 border border-white/10 rounded-xl shadow-xl">
              {loading ? (
                <div className="p-3 text-white/60">جارٍ البحث...</div>
              ) : (
                <div>{renderList()}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
