import React from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import AdminHeader from "../components/admin/AdminHeader";

const AdminLayout = () => {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex flex-col h-screen bg-transparent">
      {/* Header (contains navigation links) */}
      <AdminHeader onLogout={handleLogout} />

      {/* Main content */}
      <div className="flex-1  min-h-0">
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
