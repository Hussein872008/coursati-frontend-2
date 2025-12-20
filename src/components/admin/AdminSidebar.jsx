import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  UserGroupIcon,
  BookOpenIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";

const AdminSidebar = ({ isOpen, onToggle }) => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname.startsWith(`/admin/${path}`);
  };

  const menuItems = [
    {
      label: "لوحة التحكم",
      path: "dashboard",
      icon: Cog6ToothIcon,
    },
    {
      label: "المستخدمين",
      path: "users",
      icon: UserGroupIcon,
    },
    {
      label: "إدارة المحتوى",
      path: "content",
      icon: BookOpenIcon,
    },
  ];

  return (
    <>
      {/* Sidebar */}
      <div
        className={`$\{
          isOpen ? 'w-64' : 'w-20'
        } bg-slate-900 text-white transition-all duration-300 flex flex-col overflow-hidden shadow-lg`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {isOpen && <h1 className="text-xl font-extrabold">كورساتي</h1>}
          <button
            onClick={onToggle}
            className="text-slate-300 hover:text-white transition-colors p-1 rounded"
            title="تبديل الشريط"
          >
            {isOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={`/admin/${item.path}`}
              className={`flex items-center px-4 py-3 transition-colors $\{
                isActive(item.path)
                  ? 'bg-slate-800 text-white border-l-4 border-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={item.label}
            >
              <item.icon className="w-6 h-6" />
              {isOpen && <span className="ml-4">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800">
          <button
            className="w-full text-right text-slate-300 hover:text-white transition-colors flex items-center justify-between"
            title="الإعدادات"
          >
            {isOpen && <span className="text-sm">الإعدادات</span>}
            <span className="text-2xl">⚙️</span>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="hidden md:hidden fixed inset-0 bg-black opacity-50"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default AdminSidebar;
