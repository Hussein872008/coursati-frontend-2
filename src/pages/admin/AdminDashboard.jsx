import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminBreadcrumb from "../../components/admin/AdminBreadcrumb";
import useTitle from "../../hooks/useTitle";
import { adminAPI, videosAPI } from "../../utils/api";
// framer-motion removed for performance; use plain elements
import {
  BookOpenIcon,
  UserGroupIcon,
  FolderIcon,
  AcademicCapIcon,
  VideoCameraIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";

const Sparkline = ({ data = [], color = "#2563eb", height = 40 }) => {
  if (!data || data.length === 0)
    return <div className="text-sm text-white/70">لا بيانات</div>;
  const values = data.map((d) => d.count);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const w = Math.max(80, data.length * 6);
  const step = w / Math.max(1, data.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / (max - min || 1)) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={height} className="block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const StatCard = ({ title, value, color = "bg-blue-600", sub, icon: Icon }) => (
  <div className="p-4 rounded-xl admin-card">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-white/80">{title}</div>
        <div className="text-2xl font-bold text-white mt-2">{value}</div>
      </div>
      <div
        className={`${color} w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ring-1 ring-white/10`}
      >
        {Icon ? <Icon className="w-5 h-5 text-white" /> : null}
      </div>
    </div>
    {sub && <div className="text-xs text-white/70 mt-3">{sub}</div>}
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  useTitle("كورساتي — لوحة التحكم");
  const [series, setSeries] = useState(null);
  const [selectedRange, setSelectedRange] = useState(30);
  const [selectedMetric, setSelectedMetric] = useState("video");
  const [chartHover, setChartHover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [poller, setPoller] = useState(null);
  const [filter, setFilter] = useState('all'); // all | ok | failed
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [analysisModal, setAnalysisModal] = useState({ open: false, video: null, jobResult: null });
  const [validatingVideos, setValidatingVideos] = useState([]);
  const navigate = useNavigate();

  // cleanup poller on unmount or when poller changes
  useEffect(() => {
    // On mount: restore any in-progress job id from localStorage and resume polling
    const existing = localStorage.getItem('validateJobId');
    if (existing) {
      (async () => {
        try {
          setJobId(existing);
          const first = await adminAPI.getValidateJob(existing);
          const fj = first?.data?.job || null;
          setJob(fj);
          if (!fj || (fj.status !== 'finished' && fj.status !== 'failed')) {
            const id = setInterval(async () => {
              try {
                const r2 = await adminAPI.getValidateJob(existing);
                const j = r2?.data?.job || null;
                if (j) setJob(j);
                if (j && (j.status === 'finished' || j.status === 'failed')) {
                  clearInterval(id);
                  setPoller(null);
                }
              } catch (e) {}
            }, 2000);
            setPoller(id);
            setValidating(true);
          }
        } catch (e) {
          // ignore
        }
      })();
    }
    // cleanup when component unmounts handled by existing effect
  }, []);

  // persist jobId to localStorage
  useEffect(() => {
    if (jobId) localStorage.setItem('validateJobId', jobId);
    else localStorage.removeItem('validateJobId');
  }, [jobId]);

  // cleanup poller on unmount or when poller changes
  useEffect(() => {
    return () => {
      if (poller) clearInterval(poller);
    };
  }, [poller]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sRes, aRes, tRes] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getActivity(20),
          adminAPI.getTimeSeries(selectedRange),
        ]);
        setStats(sRes.data || {});
        setActivity(aRes.data || []);
        setSeries(tRes.data || null);
      } catch (err) {
        // Failed to load admin dashboard data (handled by UI)
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // refetch timeseries when range changes
  useEffect(() => {
    let mounted = true;
    const fetchSeries = async () => {
      try {
        const res = await adminAPI.getTimeSeries(selectedRange);
        if (!mounted) return;
        setSeries(res.data || null);
      } catch (err) {
        // Failed to load timeseries (handled by UI)
      }
    };
    fetchSeries();
    return () => {
      mounted = false;
    };
  }, [selectedRange]);

  const ChartLarge = ({ data = [], color = "#2563eb", height = 120 }) => {
    if (!data || data.length === 0)
      return <div className="text-sm text-white/70">لا بيانات</div>;
    const values = data.map((d) => d.count);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const w = Math.max(300, data.length * 10);
    const step = w / Math.max(1, data.length - 1);
    const points = values.map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / (max - min || 1)) * height;
      return [x, y];
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`)
      .join(" ");

    const handleMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.round(x / step);
      const clamped = Math.max(0, Math.min(data.length - 1, idx));
      setChartHover({
        index: clamped,
        item: data[clamped],
        x: clamped * step + rect.left,
        y: points[clamped][1] + rect.top,
      });
    };

    const handleLeave = () => setChartHover(null);

    return (
      <div className="relative overflow-auto">
        <svg
          width={w}
          height={height}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          className="block"
        >
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r={3}
              fill={i === (chartHover?.index ?? -1) ? "#fff" : color}
              stroke={color}
            />
          ))}
        </svg>
        {chartHover && (
          <div
            style={{
              position: "absolute",
              left: chartHover.x - 60,
              top: chartHover.y - 60,
            }}
            className="bg-white border rounded px-2 py-1 text-xs shadow text-gray-900"
          >
            <div className="font-medium">{chartHover.item.count} مشاهدات</div>
            <div className="text-gray-600">{chartHover.item.date}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        items={[{ label: "لوحة التحكم", path: "/admin/dashboard" }]}
      />

      <div className="flex items-center justify-end space-x-2">
        <button
          className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-60"
          onClick={async () => {
            if (validating) return;
            setValidating(true);
            setValidateResult(null);
            setJob(null);
            setJobId(null);
            try {
              const res = await adminAPI.validateAllVideos(false);
              const jid = res?.data?.jobId;
              if (!jid) throw new Error('no job id returned');
              setJobId(jid);
              // try fetching status immediately, then poll
              try {
                const first = await adminAPI.getValidateJob(jid);
                const fj = first?.data?.job || null;
                setJob(fj);
                if (fj && (fj.status === 'finished' || fj.status === 'failed')) {
                  setValidating(false);
                  setValidateResult(fj);
                } else {
                  const id = setInterval(async () => {
                    try {
                      const r2 = await adminAPI.getValidateJob(jid);
                      const j = r2?.data?.job || null;
                      if (j) setJob(j);
                      if (j && (j.status === 'finished' || j.status === 'failed')) {
                        clearInterval(id);
                        setPoller(null);
                        setValidating(false);
                        setValidateResult(j);
                      }
                    } catch (e) {
                      // ignore intermittent errors
                    }
                  }, 2000);
                  setPoller(id);
                }
              } catch (e) {
                // initial fetch failed — still start polling to retry
                const id = setInterval(async () => {
                  try {
                    const r2 = await adminAPI.getValidateJob(jid);
                    const j = r2?.data?.job || null;
                    if (j) setJob(j);
                    if (j && (j.status === 'finished' || j.status === 'failed')) {
                      clearInterval(id);
                      setPoller(null);
                      setValidating(false);
                      setValidateResult(j);
                    }
                  } catch (err) {
                    // ignore
                  }
                }, 2000);
                setPoller(id);
              }
            } catch (err) {
              setValidateResult({ ok: false, error: err?.response?.data || err?.message || String(err) });
              setValidating(false);
            }
          }}
          disabled={validating}
        >
          {validating ? "جاري التحقق..." : "تحقق من كل الفيديوهات"}
        </button>
        {jobId && (
          <button
            className="px-3 py-2 bg-white/10 text-white rounded-md"
            onClick={async () => {
              // refresh once
              try {
                const r = await adminAPI.getValidateJob(jobId);
                setJob(r?.data?.job || null);
              } catch (e) {}
            }}
          >
            تحديث الحالة
          </button>
        )}
      </div>

      {/* Job progress UI */}
      {job && (
        <div className="admin-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/80">حالة التحقق: {job.status}</div>
              <div className="text-xs text-white/70">معالجــة {job.processedVideos}/{job.totalVideos}</div>
              {job.currentVideo && <div className="text-xs text-white/70">جارٍ الآن: {job.currentVideo.title}</div>}
            </div>
            <div className="w-1/3">
              <div className="bg-white/10 h-2 rounded overflow-hidden">
                <div
                  className="h-2 bg-indigo-500"
                  style={{ width: `${job.totalVideos ? Math.round((job.processedVideos / job.totalVideos) * 100) : 0}%` }}
                />
              </div>
            </div>
            <div className="ml-4 flex items-center gap-2">
              {job && job.paused ? (
                <button className="px-3 py-1 bg-emerald-600 text-white rounded" onClick={async ()=>{ try{ await adminAPI.resumeValidateJob(job.id); const r=await adminAPI.getValidateJob(job.id); setJob(r.data.job); }catch(e){} }}>استئناف</button>
              ) : (
                <button className="px-3 py-1 bg-yellow-600 text-white rounded" onClick={async ()=>{ try{ await adminAPI.pauseValidateJob(job.id); const r=await adminAPI.getValidateJob(job.id); setJob(r.data.job); }catch(e){} }}>إيقاف مؤقت</button>
              )}
              <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="px-2 py-1 bg-white/5 text-white rounded">
                <option value="all">الكل</option>
                <option value="ok">الناجحة فقط</option>
                <option value="failed">الفاشلة فقط</option>
              </select>
            </div>
          </div>
          <div className="mt-3 text-xs text-white/70">
            <div>مقاطع مكتملة: {job.videos.length}</div>
            <ul className="list-disc list-inside max-h-48 overflow-auto mt-2">
              {job.videos.slice().reverse().filter((vv)=>{
                if (filter==='all') return true;
                if (filter==='ok') return !!vv.ok;
                return !vv.ok;
              }).slice(0, 50).map((v) => (
                <li key={String(v.videoId)} className="mb-1 flex items-center gap-3">
                  <span className="font-medium">{v.title}</span>
                  <span>{v.ok ? <span className="text-green-400">OK</span> : <span className="text-red-400">فشل</span>}</span>
                  {v.lectureId && (
                    <a
                      href={`/admin/content/lecture/${v.lectureId}?highlight=${v.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-white/70 underline"
                    >اذهب للفيديو</a>
                  )}
                  {!v.ok && (
                    <button className="text-xs px-2 py-1 bg-white/10 rounded" onClick={async ()=>{
                      try{
                        await adminAPI.revalidateJobVideo(job.id, v.videoId);
                        const r=await adminAPI.getValidateJob(job.id);
                        setJob(r.data.job);
                      }catch(e){ }
                    }}>اعادة تحقق</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Videos list with improved layout */}
      <div className="admin-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">قائمة الفيديوهات</h3>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 bg-indigo-600 text-white rounded-md"
              onClick={async () => {
                setVideosLoading(true);
                try {
                  const r = await adminAPI.getAllVideos();
                  setVideos((r.data && r.data.videos) || []);
                  setPage(1);
                } catch (e) {
                } finally {
                  setVideosLoading(false);
                }
              }}
            >
              تحميل الفيديوهات
            </button>
            <select value={filter} onChange={(e)=>setFilter(e.target.value)} className="px-2 py-1 bg-white/5 text-white rounded">
              <option value="all">الكل</option>
              <option value="ok">الناجحة فقط</option>
              <option value="failed">الفاشلة فقط</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-white/80">
                <th className="px-3 py-2">العنوان</th>
                <th className="px-3 py-2">الفصل</th>
                <th className="px-3 py-2">تاريخ الإنشاء</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // build a map from job results for quick lookup
                const jobMap = {};
                if (job && job.videos && Array.isArray(job.videos)) {
                  for (const v of job.videos) jobMap[String(v.videoId)] = v;
                }
                const filtered = videos.filter((v) => {
                  if (!filter || filter === 'all') return true;
                  const jr = jobMap[String(v._id)] || v._lastValidation;
                  if (filter === 'ok') return jr && jr.ok;
                  if (filter === 'failed') return jr && !jr.ok;
                  return true;
                });
                const start = (page - 1) * perPage;
                const pageItems = filtered.slice(start, start + perPage);
                if (pageItems.length === 0) return (
                  <tr><td colSpan={5} className="px-3 py-4 text-white/60">لا توجد فيديوهات للعرض</td></tr>
                );
                return pageItems.map((v) => {
                  const jr = jobMap[String(v._id)] || v._lastValidation;
                  return (
                    <tr key={String(v._id)} className="border-t border-white/5">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-white">{v.title}</div>
                        <div className="text-xs text-white/60">{v._id}</div>
                      </td>
                      <td className="px-3 py-2 align-top text-white/70">{v.lectureId || '-'}</td>
                      <td className="px-3 py-2 align-top text-white/70">{new Date(v.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 align-top">
                        {jr ? (
                          jr.ok ? <span className="px-2 py-1 bg-green-600 text-white rounded text-xs">ناجح</span> : <span className="px-2 py-1 bg-red-600 text-white rounded text-xs">فشل</span>
                        ) : (
                          <span className="px-2 py-1 bg-white/10 text-white rounded text-xs">غير مختبر</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            className="px-2 py-1 bg-white/10 rounded text-xs"
                            disabled={validatingVideos.includes(String(v._id))}
                            onClick={async ()=>{
                              // prevent duplicate clicks
                              if (validatingVideos.includes(String(v._id))) return;
                              setValidatingVideos((s)=>[...s, String(v._id)]);
                              const removeValidating = ()=>setValidatingVideos((s)=>s.filter(x=>x!==String(v._id)));
                              try{
                                if (job && job.id) {
                                  // append result to current job and refresh job
                                  const r = await adminAPI.revalidateJobVideo(job.id, v._id);
                                  const rec = r?.data?.rec;
                                  try{
                                    const jr = await adminAPI.getValidateJob(job.id);
                                    setJob(jr.data.job);
                                  }catch(e){}
                                  // update row in-place
                                  setVideos((prev)=>prev.map((x)=> x._id===v._id ? { ...x, _lastValidation: rec } : x));
                                } else {
                                  // standalone validation
                                  const r = await videosAPI.validateVideo(v._id, false);
                                  const results = r?.data?.results;
                                  const computeOk = (res)=>{
                                    try{
                                      const quals = Object.values(res||{});
                                      for (const arr of quals) {
                                        for (const it of arr) {
                                          if (it && it.ok === false) return false;
                                        }
                                      }
                                      return true;
                                    }catch(e){return false}
                                  };
                                  const ok = computeOk(results);
                                  const rec = { videoId: v._id, lectureId: v.lectureId, title: v.title, ok, results, processedAt: new Date() };
                                  setVideos((prev)=>prev.map((x)=> x._id===v._id ? { ...x, _lastValidation: rec } : x));
                                }
                              }catch(e){}
                              finally{ removeValidating(); }
                            }}
                          >
                            {validatingVideos.includes(String(v._id)) ? 'جاري...' : 'تحقق'}
                          </button>
                          {v.lectureId && (
                            <a className="text-xs text-white/70 underline" href={`/admin/content/lecture/${v.lectureId}?highlight=${v._id}`} target="_blank" rel="noopener noreferrer">اذهب</a>
                          )}
                          <button className="text-xs px-2 py-1 bg-white/10 rounded" onClick={()=>{
                            const jr = jobMap[String(v._id)] || v._lastValidation;
                            setAnalysisModal({ open: true, video: v, jobResult: jr || null });
                          }}>تحليل</button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-white/70">عرض {Math.min(videos.length, (page)*perPage)} من {videos.length}</div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 bg-white/5 rounded" disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1,p-1))}>السابق</button>
            <div className="text-xs text-white/80">صفحة {page}</div>
            <button className="px-2 py-1 bg-white/5 rounded" disabled={(page*perPage)>=videos.length} onClick={()=>setPage((p)=>p+1)}>التالي</button>
          </div>
        </div>
      </div>

      {/* Analysis modal */}
      {analysisModal.open && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setAnalysisModal({open:false, video:null, jobResult:null})} />
          <div className="bg-white max-w-2xl w-full rounded p-4 z-10 text-gray-900">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">تحليل الفيديو: {analysisModal.video?.title}</h4>
              <button className="text-sm text-gray-600" onClick={()=>setAnalysisModal({open:false, video:null, jobResult:null})}>إغلاق</button>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-700">معرّف الفيديو: {analysisModal.video?._id}</div>
              <div className="mt-2 text-sm text-gray-800">نتيجة التحقق:</div>
              <pre className="mt-2 p-3 bg-gray-100 rounded max-h-64 overflow-auto text-xs">{JSON.stringify(analysisModal.jobResult || { note: 'لا توجد نتيجة' }, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="المواد"
          value={stats?.totals?.materials ?? "–"}
          color="bg-blue-600"
          icon={BookOpenIcon}
          sub={
            series ? (
              <Sparkline data={series.materialSeries} color="#93c5fd" />
            ) : null
          }
        />
        <StatCard
          title="المستخدمون"
          value={stats?.totals?.users ?? "–"}
          color="bg-teal-500"
          icon={UserGroupIcon}
        />
        <StatCard
          title="المدرّسون"
          value={stats?.totals?.instructors ?? "–"}
          color="bg-amber-500"
          icon={UserGroupIcon}
        />
        <StatCard
          title="الفصول"
          value={stats?.totals?.chapters ?? "–"}
          color="bg-emerald-500"
          icon={FolderIcon}
        />
        <StatCard
          title="المحاضرات"
          value={stats?.totals?.lectures ?? "–"}
          color="bg-purple-600"
          icon={AcademicCapIcon}
          sub={
            series ? (
              <Sparkline data={series.lectureSeries} color="#c4b5fd" />
            ) : null
          }
        />
        <StatCard
          title="الفيديوهات"
          value={stats?.totals?.videos ?? "–"}
          color="bg-indigo-600"
          icon={VideoCameraIcon}
          sub={
            series ? (
              <Sparkline data={series.videoSeries} color="#93c5fd" />
            ) : null
          }
        />
        <StatCard
          title="الملفات (PDF)"
          value={stats?.totals?.pdfs ?? "–"}
          color="bg-green-600"
          icon={DocumentTextIcon}
          sub={
            series ? (
              <Sparkline data={series.pdfSeries} color="#86efac" />
            ) : null
          }
        />
      </div>

      <div className="admin-card p-6">
        <h3 className="text-lg font-bold mb-4">النشاط الأخير</h3>
        {loading ? (
          <div className="text-white/70">جاري التحميل...</div>
        ) : activity.length === 0 ? (
          <div className="text-white/70">لا توجد نشاطات حديثة</div>
        ) : (
          <ul className="space-y-2">
            {activity.map((it, i) => (
              <li key={i} className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">
                    {it.type === "video"
                      ? `فيديو: ${it.title}`
                      : it.type === "pdf"
                        ? `ملف: ${it.title}`
                        : `مستخدم: ${it.name}`}
                  </div>
                  <div className="text-xs text-white/70">
                    {new Date(it.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-gray-900 bg-white/20 px-2 py-1 rounded">
                  {it.type.toUpperCase()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
