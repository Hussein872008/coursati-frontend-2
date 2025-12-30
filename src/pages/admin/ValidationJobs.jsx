import React, { useEffect, useState } from 'react';
import AdminBreadcrumb from '../../components/admin/AdminBreadcrumb';
import { adminAPI } from '../../utils/api';
import useTitle from '../../hooks/useTitle';
import { toast } from 'react-toastify';

export default function ValidationJobs() {
  useTitle('عمليات التحقق - لوحة التحكم');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [revalidateLoading, setRevalidateLoading] = useState({});

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.listValidateJobs();
      setJobs(res.data?.jobs || []);
    } catch (e) {
      console.error('load jobs error', e);
      toast.error('فشل تحميل المهام');
    } finally {
      setLoading(false);
    }
  };

  const startValidation = async (mirror = false) => {
    try {
      setJobLoading(true);
      const res = await adminAPI.validateAllVideos(mirror);
      toast.success('تم بدء عملية التحقق');
      // reload list and select latest job
      await loadJobs();
      if (res.data?.jobId) {
        await loadJobDetail(res.data.jobId);
      } else {
        // try fetch latest
        const list = await adminAPI.listValidateJobs();
        const newest = (list.data?.jobs || [])[0];
        if (newest) loadJobDetail(newest.id || newest._id);
      }
    } catch (e) {
      console.error('start validation error', e);
      toast.error('فشل بدء عملية التحقق');
    } finally {
      setJobLoading(false);
    }
  };

  const loadJobDetail = async (id) => {
    try {
      setJobLoading(true);
      const res = await adminAPI.getValidateJob(id);
      setSelected(res.data?.job || null);
    } catch (e) {
      console.error('load job detail', e);
      toast.error('فشل تحميل تفاصيل المهمة');
    } finally {
      setJobLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // Poll selected job for live updates
  useEffect(() => {
    if (!selected || !(selected.id || selected._id)) return undefined;
    let mounted = true;
    const id = selected.id || selected._id;
    const iv = setInterval(async () => {
      try {
        const res = await adminAPI.getValidateJob(id);
        if (!mounted) return;
        setSelected(res.data?.job || null);
      } catch (e) {
        // ignore polling errors
      }
    }, 5000);
    return () => { mounted = false; clearInterval(iv); };
  }, [selected && (selected.id || selected._id)]);

  const revalidateVideo = async (videoId) => {
    if (!selected || !selected.id) return;
    try {
      setRevalidateLoading((s) => ({ ...s, [videoId]: true }));
      const res = await adminAPI.revalidateJobVideo(selected.id, videoId);
      toast.success('تمت إعادة التحقق للفيديو');
      // update selected job videos
      if (res.data?.rec) {
        setSelected((prev) => {
          if (!prev) return prev;
          const videos = Array.isArray(prev.videos) ? [...prev.videos] : [];
          const idx = videos.findIndex((v) => String(v.videoId) === String(videoId));
          if (idx >= 0) videos[idx] = res.data.rec;
          else videos.push(res.data.rec);
          return { ...prev, videos };
        });
      }
    } catch (e) {
      console.error('revalidate error', e);
      toast.error('فشل إعادة التحقق');
    } finally {
      setRevalidateLoading((s) => ({ ...s, [videoId]: false }));
    }
  };

  const downloadJob = async (job) => {
    try {
      const res = await adminAPI.getValidateJob(job.id || job._id);
      const jobData = res.data?.job || res.data || null;
      if (!jobData) return toast.error('لا توجد بيانات');
      const blob = new Blob([JSON.stringify(jobData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation-job-${job.id || job._id || Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('download job error', e);
      toast.error('فشل تنزيل المهمة');
    }
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb items={[{ label: 'لوحة التحكم', path: '/admin/dashboard' }, { label: 'عمليات التحقق' }]} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">قائمة المهام</h3>
            <div className="flex items-center gap-2">
              <button onClick={loadJobs} className="px-3 py-1 bg-slate-700 text-white rounded">تحديث</button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.length === 0 && <div className="text-sm text-slate-400">لا توجد مهام</div>}
              {jobs.map((j) => (
                <div key={j.id || j._id} className={`p-3 rounded-lg border ${selected && (selected.id === (j.id||j._id)) ? 'border-cyan-400' : 'border-slate-700'} bg-slate-800/40`}> 
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-200 font-medium">{j.id || j._id}</div>
                      <div className="text-xs text-slate-400 mt-1">{j.status || 'unknown'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => loadJobDetail(j.id || j._id)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">عرض</button>
                      <button onClick={() => downloadJob(j)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">تنزيل</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">تفاصيل المهمة</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => selected && loadJobDetail(selected.id || selected._id)} className="px-3 py-1 bg-slate-700 text-white rounded">تحديث</button>
            </div>
          </div>

          {jobLoading ? (
            <div className="text-white/70">جاري التحميل...</div>
          ) : !selected ? (
            <div className="text-sm text-slate-400">اختر مهمة لعرض التفاصيل</div>
          ) : (
            <div>
              <div className="mb-3 text-sm text-slate-300">معرّف: <span className="font-mono text-xs text-slate-200">{selected.id || selected._id}</span></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-slate-800/40 rounded">
                  <div className="text-xs text-slate-400">الحالة</div>
                  <div className="font-medium text-white mt-1">{selected.status}</div>
                </div>
                <div className="p-3 bg-slate-800/40 rounded">
                  <div className="text-xs text-slate-400">إجمالي الفيديوهات</div>
                  <div className="font-medium text-white mt-1">{selected.totalVideos || selected.videos?.length || 0}</div>
                </div>
                <div className="p-3 bg-slate-800/40 rounded">
                  <div className="text-xs text-slate-400">مكتمل</div>
                  <div className="font-medium text-white mt-1">{selected.processedVideos || 0}</div>
                </div>
              </div>

              <div className="space-y-2">
                {(selected.videos && selected.videos.length > 0) ? selected.videos.map((v) => (
                  <div key={String(v.videoId) + String(v.segment || '')} className="p-3 bg-slate-800/60 rounded border border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{v.title || v.videoId}</div>
                        <div className="text-xs text-slate-400">{v.lectureId ? `Lecture: ${v.lectureId}` : ''} {v.processedAt ? `— ${new Date(v.processedAt).toLocaleString()}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {v.ok === true ? (
                          <div className="text-sm text-emerald-400">متاح</div>
                        ) : v.ok === false ? (
                          <div className="text-sm text-rose-400">غير متاح</div>
                        ) : (
                          <div className="text-sm text-slate-300">قيد المعالجة</div>
                        )}

                        <button disabled={!!revalidateLoading[v.videoId]} onClick={() => revalidateVideo(v.videoId)} className="px-2 py-1 bg-cyan-600 text-white rounded text-xs">إعادة التحقق</button>
                      </div>
                    </div>

                    {/* show per-quality summary if present */}
                    {v.summary && v.summary.qualities && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        {Object.keys(v.summary.qualities).map((qk) => {
                          const q = v.summary.qualities[qk];
                          return (
                            <div key={qk} className="p-2 bg-slate-800 rounded text-slate-200">
                              <div className="font-medium">{qk}</div>
                              <div className="text-slate-400 text-xs">فحوصات: {q.totalChecked || 0}</div>
                              <div className="text-rose-400 text-xs">فشل: {q.failedCount || 0}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* detailed results / mirror errors */}
                    {v.results && Object.keys(v.results).length > 0 && (
                      <div className="mt-2 bg-slate-900 rounded p-2 text-xs text-slate-300 max-h-56 overflow-auto">
                        {Object.keys(v.results).map((qk) => (
                          qk === '_meta' ? null : (
                            <div key={qk} className="mb-2">
                              <div className="text-xs font-medium text-white mb-1">جودة {qk}</div>
                              <div className="space-y-1">
                                {(v.results[qk]||[]).map((seg) => (
                                  <div key={seg.segment + String(seg.url || '')} className="flex items-center justify-between text-xs bg-slate-800/30 p-1 rounded">
                                    <div className="truncate mr-2">
                                      <div className="text-slate-200">Segment {seg.segment}</div>
                                      <div className="text-slate-400 truncate">{seg.ok ? 'OK' : 'FAIL'} — {seg.url ? seg.url : (seg.error || '')}</div>
                                    </div>
                                    <div className="text-right">
                                      {seg.mirrored ? <div className="text-emerald-400">Mirrored</div> : seg.mirrorError ? <div className="text-rose-400">Mirror error</div> : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}

                        {/* show mirrorErrors summary if present */}
                        {v.summary && v.summary.meta && <div className="mt-3 text-xs text-slate-400">ملخص: {JSON.stringify(v.summary.meta)}</div>}
                      </div>
                    )}

                    {/* if there's an error stack or mirrorError show details */}
                    {(v.errorStack || v.mirrorError) && (
                      <div className="mt-2 p-2 bg-slate-900 rounded text-xs text-slate-300">
                        {v.errorStack && (
                          <div className="mb-2">
                            <div className="font-medium text-white text-sm">تفاصيل الخطأ</div>
                            <pre className="text-xs mt-1 max-h-40 overflow-auto bg-slate-800 p-2 rounded">{v.errorStack}</pre>
                          </div>
                        )}
                        {v.mirrorError && (
                          <div>
                            <div className="font-medium text-white text-sm">خطأ المرآة</div>
                            <pre className="text-xs mt-1 max-h-40 overflow-auto bg-slate-800 p-2 rounded">{JSON.stringify(v.mirrorError, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )) : (
                  <div className="text-sm text-slate-400">لا توجد نتائج للفيديوهات</div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
