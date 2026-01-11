import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import AdminBreadcrumb from "../../components/admin/AdminBreadcrumb";
import { toast } from "react-toastify";
import useTitle from "../../hooks/useTitle";
import { adminAPI, videosAPI, notificationsAPI } from "../../utils/api";
// framer-motion removed for performance; use plain elements
import {
  BookOpenIcon,
  UserGroupIcon,
  FolderIcon,
  AcademicCapIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  BellIcon,
  StopIcon,
} from "@heroicons/react/24/solid";
import { FiPause, FiPlay } from "react-icons/fi";

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
  const [filter, setFilter] = useState('all'); // all | ok | failed
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videoSummary, setVideoSummary] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [analysisModal, setAnalysisModal] = useState({ open: false, video: null, jobResult: null });
  const [validatingVideos, setValidatingVideos] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, loading: false });
  const navigate = useNavigate();
  // Revalidation removed: no background jobs started from the dashboard.

  // Delete all notifications
  const deleteAllNotifications = async () => {
    setConfirmModal({
      open: true,
      title: 'حذف جميع الاشعارات',
      message: 'هل أنت متأكد من حذف جميع الاشعارات؟ لا يمكن التراجع عن هذا الإجراء.',
      onConfirm: async () => {
        try {
          setConfirmModal(prev => ({ ...prev, loading: true }));
          await notificationsAPI.deleteAll();
          setConfirmModal({ open: false, title: '', message: '', onConfirm: null, loading: false });
          toast.success('تم حذف جميع الاشعارات بنجاح');
        } catch (e) {
          toast.error('حدث خطأ أثناء حذف الاشعارات');
          setConfirmModal({ open: false, title: '', message: '', onConfirm: null, loading: false });
        }
      },
      loading: false
    });
  };

  // Validation subsystem removed; related UI removed below.

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
        try {
          const vs = await adminAPI.getVideoStatusSummary();
          if (vs && vs.data) {
            setVideos(vs.data.perLecture || []);
            setVideoSummary(vs.data || null);
          }
        } catch (e) {
          // ignore video status fetch errors
        }
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
      
      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !confirmModal.loading && setConfirmModal({ open: false, title: '', message: '', onConfirm: null, loading: false })}
          />
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 z-10 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-3">{confirmModal.title}</h3>
            <p className="text-gray-300 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => !confirmModal.loading && setConfirmModal({ open: false, title: '', message: '', onConfirm: null, loading: false })}
                disabled={confirmModal.loading}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmModal.onConfirm}
                disabled={confirmModal.loading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {confirmModal.loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    جاري...
                  </>
                ) : (
                  'تأكيد'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
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
              <div className="mt-2 text-sm text-gray-800">نتيجة التحليل:</div>
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
          title="حالة الفيديوهات"
          value={videoSummary ? `${videoSummary.health}%` : '–'}
          color="bg-emerald-600"
          icon={VideoCameraIcon}
          sub={videoSummary ? `${videoSummary.broken || 0} معطلة / ${videoSummary.total || 0}` : null}
        />
        <Link to="/admin/videos-status" className="block w-full text-left">
          <div className="p-4 rounded-xl admin-card hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/80">مراقبة الفيديوهات</div>
                <div className="text-2xl font-bold text-white mt-2">عرض الحالة التفصيلية</div>
              </div>
              <div className={`bg-indigo-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ring-1 ring-white/10`}>
                <VideoCameraIcon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-xs text-white/70 mt-3">انتقل لصفحة مراقبة حالة الفيديوهات وإعادة الفحص</div>
          </div>
        </Link>
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
        {/* LecturesHealth removed */}
        {/* Clear Notifications Card */}
        <button onClick={deleteAllNotifications} className="block w-full text-left">
          <div className="p-4 rounded-xl admin-card hover:shadow-lg transition-all duration-200 hover:from-red-900/30 hover:to-red-800/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/80">الاشعارات</div>
                <div className="text-2xl font-bold text-white mt-2">حذف الكل</div>
              </div>
              <div className={`bg-red-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ring-1 ring-white/10`}>
                <BellIcon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-xs text-white/70 mt-3">حذف جميع الاشعارات المتراكمة</div>
          </div>
        </button>
        
        
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
