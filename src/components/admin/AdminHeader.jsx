import React, { useRef, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { adminAPI } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";
import InstallButton from "../InstallButton";
import { Link, useLocation } from "react-router-dom";
import NotificationBell from "../NotificationBell";
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/solid";

const menuItems = [
  {
    label: "لوحة التحكم",
    path: "/admin/dashboard",
    icon: Cog6ToothIcon,
    color: "from-cyan-500 to-blue-500",
  },
  {
    label: "المستخدمين",
    path: "/admin/users",
    icon: UserGroupIcon,
    color: "from-emerald-500 to-teal-500",
  },
  {
    label: "إدارة المحتوى",
    path: "/admin/content/materials",
    icon: BookOpenIcon,
    color: "from-purple-500 to-pink-500",
  },
];

const AdminHeader = ({ onLogout }) => {
  const { user } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const location = useLocation();
  const menuRef = useRef(null);
  const btnRef = useRef(null);
  const prevFailedRef = useRef(0);

  const isActive = (path) => location.pathname.startsWith(path);

  // Close menu on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!showUserMenu) return;
      const menuEl = menuRef.current;
      const btnEl = btnRef.current;
      if (
        menuEl &&
        !menuEl.contains(e.target) &&
        btnEl &&
        !btnEl.contains(e.target)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showUserMenu]);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);



  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? "bg-gray-900/95 backdrop-blur-xl shadow-2xl shadow-blue-900/20" : "bg-gradient-to-r from-gray-900/95 via-blue-900/90 to-purple-900/95 backdrop-blur-xl"}`}
    >
      {/* Glowing Border */}
      <div className="absolute inset-0 rounded-b-3xl bg-gradient-to-r from-cyan-500/10 via-transparent to-purple-500/10 pointer-events-none" />

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden rounded-b-3xl pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400/30 rounded-full animate-pulse"
            style={{
              left: `${10 + i * 20}%`,
              top: `${50 + Math.sin(i) * 20}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: "3s",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-between px-4 md:px-6 py-3 md:py-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl blur-lg opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative w-full h-full bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <ShieldCheckIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="hidden md:block">
              <h1 className="text-xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                كورساتي
              </h1>
              <div className="text-xs text-cyan-300/80 font-medium">
                لوحة الإدارة
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Navigation (icons visible always) */}
        <nav className="flex-1 flex justify-center gap-2 flex-wrap px-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative group flex items-center gap-2 px-2 py-2 rounded-xl text-sm font-medium transition-all duration-500
                ${isActive(item.path) ? `bg-gradient-to-r ${item.color} text-white shadow-lg` : "text-white/80 hover:text-white hover:bg-white/5"}`}
            >
              {isActive(item.path) && (
                <>
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full animate-ping pointer-events-none" />
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur-sm pointer-events-none" />
                </>
              )}
              <item.icon
                className={`w-5 h-5 transition-transform duration-300 ${isActive(item.path) ? "scale-110" : "group-hover:scale-110"}`}
              />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <NotificationBell />
          <div className="relative inline-block">
            <button
              ref={btnRef}
              onClick={() => setShowUserMenu((s) => !s)}
              aria-expanded={showUserMenu}
              className="group flex items-center gap-2 text-white p-1.5 rounded-xl hover:bg-white/5 transition-all duration-300"
            >
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full blur-md opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative w-full h-full bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20">
                  {user?.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <UserCircleIcon className="w-8 h-8 text-white" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-gray-900 animate-pulse" />
              </div>
              <ChevronDownIcon
                className={`w-5 h-5 text-cyan-300 transition-transform duration-300 ${showUserMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showUserMenu && (
              <div
                ref={menuRef}
                style={{
                  right: 1,
                  left: "auto",
                  maxWidth: "calc(100vw - 24px)",
                }}
                className="absolute top-full right-0 mt-2 w-auto max-w-[calc(100vw-24px)] bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-blue-900/30 border border-white/10 overflow-hidden origin-top-right"
              >
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all duration-300 group"
                  >
                    <span className="text-sm font-medium flex items-center gap-3">
                      <div className="p-1.5 bg-gradient-to-r from-rose-500/10 to-pink-500/10 rounded-lg group-hover:from-rose-500/20 group-hover:to-pink-500/20 transition-all duration-300">
                        <ArrowRightOnRectangleIcon className="w-5 h-5 text-rose-400 group-hover:text-rose-300" />
                      </div>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
