import React, { useEffect, useState } from "react";
import AdminBreadcrumb from "../../components/admin/AdminBreadcrumb";
import useTitle from "../../hooks/useTitle";
import { adminAPI } from "../../utils/api";
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
