import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  ArrowLeftIcon,
  UserCircleIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { AcademicCapIcon as AcademicCapSolid } from "@heroicons/react/24/solid";

const NotificationBell = React.lazy(() => import("../NotificationBell"));
const SearchBar = React.lazy(() => import("./SearchBar"));

const UserHeader = ({ showBackButton = true }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setUserMenuOpen(false);
      }
    };

    const handleKey = (e) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);
  // compute a user-friendly subscription label (remaining time or expired)
  const subscriptionLabel = (() => {
    if (!user) return "غير معروف";
    if (user.subscriptionType === "permanent") return "دائم";
    const expires = user.subscriptionExpires
      ? new Date(user.subscriptionExpires)
      : null;
    if (!expires || isNaN(expires)) return "منتهي";
    const diff = expires.getTime() - Date.now();
    if (diff <= 0) return "منتهي";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days} يوم${hours > 0 ? ` ${hours} س` : ""}`;
    if (hours > 0) return `${hours} س ${minutes} د`;
    return `${minutes} د`;
  })();

  const remainingPrefix = (() => {
    if (!user) return null;
    if (user.subscriptionType === "permanent") return null;
    const expires = user.subscriptionExpires
      ? new Date(user.subscriptionExpires)
      : null;
    if (!expires || isNaN(expires)) return "الوقت المتبقي: منتهي";
    const diff = expires.getTime() - Date.now();
    if (diff <= 0) return "الوقت المتبقي: منتهي";
    return `الوقت المتبقي: ${subscriptionLabel}`;
  })();

  const subscriptionStatusClass = (() => {
    if (!user) return "text-white/60";
    if (user.subscriptionType === "permanent") return "text-emerald-300";
    const expires = user.subscriptionExpires
      ? new Date(user.subscriptionExpires)
      : null;
    if (!expires || isNaN(expires)) return "text-red-400";
    const diff = expires.getTime() - Date.now();
    if (diff <= 0) return "text-red-400";
    if (diff < 1000 * 60 * 60 * 24) return "text-yellow-300";
    return "text-white/60";
  })();

  const expiryTitle = (() => {
    if (!user) return "";
    if (user.subscriptionType === "permanent") return "اشتراك دائم";
    const expires = user.subscriptionExpires
      ? new Date(user.subscriptionExpires)
      : null;
    if (!expires || isNaN(expires)) return "انتهى الاشتراك";
    return `ينتهي في ${expires.toLocaleString()}`;
  })();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="h-16 flex items-center justify-between gap-2">
          {/* القسم الأيسر */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 shrink-0">
                <AcademicCapSolid className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>

              <div className="min-w-0 hidden sm:block">
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent truncate">
                  كورساتي
                </h1>
                <p className="text-[10px] sm:text-xs text-white/60 truncate">
                  منصة التعليم الذكي
                </p>
              </div>
            </a>
          </div>

          {/* Search (center) */}
          <div className="flex-1 px-2 ">
            <React.Suspense fallback={<div />}> 
              <SearchBar />
            </React.Suspense>
          </div>

          {/* القسم الأيمن */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* الإشعارات */}
            <div className="flex items-center">
              <React.Suspense
                fallback={
                  <button
                    aria-label="الإشعارات"
                    className="flex items-center p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 transition text-white"
                  >
                    <BellIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white/80" />
                  </button>
                }
              >
                <NotificationBell />
              </React.Suspense>
            </div>

            {/* المستخدم */}
            <div className="relative">
                <button
                  ref={buttonRef}
                  onClick={() => setUserMenuOpen((s) => !s)}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  className="
                    flex items-center gap-2
                    p-1.5 sm:p-2
                    rounded-xl
                    bg-white/10 hover:bg-white/20
                    transition
                  "
                >
                <UserCircleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white/80" />

                <div className="text-right hidden sm:block">
                  <div
                    className="text-sm sm:text-base font-semibold text-white truncate max-w-[180px]"
                    title={user?.name || "المستخدم"}
                  >
                    {user?.name || "المستخدم"}
                  </div>
                  <div className="flex flex-col">
                    {remainingPrefix && (
                      <div className="text-[11px] text-white/60">
                        {remainingPrefix}
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Dropdown */}
              <div
                ref={menuRef}
                id="user-menu-dropdown"
                className={`
                  absolute
                  left-0
                  mt-2
                  w-64
                  bg-gray-800/95 backdrop-blur-xl
                  border border-white/10
                  rounded-xl
                  shadow-xl
                  transition-all duration-200
                  z-50
                  ${userMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1"}
                `}
              >
                <div className="p-3 text-right">
                  <div className="mb-2">
                    <div className="text-sm text-white/60">أهلاً</div>
                    <div
                      className="text-lg font-semibold text-white truncate"
                      title={user?.name || ""}
                    >
                      {user?.name || "المستخدم"}
                    </div>
                    {remainingPrefix && (
                      <div className="text-[12px] text-white/60 mt-1">
                        {remainingPrefix}
                      </div>
                    )}
                  </div>
                  {/* Extra details */}
                  <div className="mt-3 text-right text-xs text-white/60">
                    {user?.code && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate">
                          كود المستخدم:{" "}
                          <span className="text-white">{user.code}</span>
                        </div>
                      </div>
                    )}

                    {user?.createdAt && (
                      <div className="mt-1">
                        انضم:{" "}
                        <span className="text-white">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {user?.subscriptionExpires && (
                      <div className="mt-1">
                        ينتهي:{" "}
                        <span className="text-white">
                          {new Date(user.subscriptionExpires).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 justify-end text-right px-3 py-2 text-red-400 hover:bg-red-500/20 rounded-xl transition"
                    >
                      <ArrowRightOnRectangleIcon className="w-5 h-5" />
                      <span>تسجيل خروج</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default UserHeader;
