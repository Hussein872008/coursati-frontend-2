import React, { Suspense, lazy, useRef } from "react";
import {
  createBrowserRouter,
  Navigate,
  useParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
// Lazy-load primary user pages to reduce initial bundle
const LoginPage = lazy(() => import("./pages/user/LoginPage"));
const MaterialsPage = lazy(() => import("./pages/user/MaterialsPage"));
const InstructorsPage = lazy(() => import("./pages/user/InstructorsPage"));
const InstructorDetailsPage = lazy(
  () => import("./pages/user/InstructorDetailsPage"),
);
const ChapterLecturesPage = lazy(
  () => import("./pages/user/ChapterLecturesPage"),
);
const LectureContentPage = lazy(
  () => import("./pages/user/LectureContentPage"),
);
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));

// Lazy load admin pages
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const MaterialsList = lazy(() => import("./pages/admin/content/MaterialsList"));
const MaterialDetail = lazy(
  () => import("./pages/admin/content/MaterialDetail"),
);
const InstructorDetail = lazy(
  () => import("./pages/admin/content/InstructorDetail"),
);
const ChapterDetail = lazy(() => import("./pages/admin/content/ChapterDetail"));
const LectureDetail = lazy(() => import("./pages/admin/content/LectureDetail"));
const AdminLectureRedirect = lazy(() => import("./pages/admin/content/AdminLectureRedirect"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-xl text-gray-600">Loading...</div>
  </div>
);

// Redirect helper to send /.../lectures -> chapter detail (removes duplicate page)
function RedirectLecturesToChapter() {
  const { materialId, instructorId, chapterId } = useParams();
  return (
    <Navigate
      to={`/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}`}
      replace
    />
  );
}

// HomeEntry: centralized small root layout to handle installed-admin redirect on initial open
function HomeEntry() {
  const { isLoggedIn, user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const initialPathRef = useRef(location.pathname);
  const consumedRef = useRef(false);

  React.useEffect(() => {
    if (consumedRef.current) return;
    // Only consider the case where the app was opened initially at '/'
    if (initialPathRef.current !== "/") {
      consumedRef.current = true;
      return;
    }
    // Wait until auth finishes loading
    if (loading) return;
    // If not logged in, no redirect
    if (!isLoggedIn) {
      consumedRef.current = true;
      return;
    }

    const isStandalone =
      typeof window !== "undefined" &&
      ((window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches) ||
        (navigator && navigator.standalone));
    if (isStandalone && user && user.isAdmin && location.pathname === "/") {
      // Redirect once to /admin on initial open only
      navigate("/admin", { replace: true });
    }
    consumedRef.current = true;
  }, [loading, isLoggedIn, user, location.pathname, navigate]);

  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            Loading...
          </div>
        }
      >
        <MaterialsPage />
      </Suspense>
    </ProtectedRoute>
  );
}

// Protected Route Component
function ProtectedRoute({ children, requiredAdmin = false }) {
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) return <LoadingFallback />;

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requiredAdmin && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Route guard for numeric IDs
const requireNumericId = (id) => {
  return /^\d+$/.test(id);
};

// Error Element for invalid routes
const ErrorElement = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <h1 className="text-3xl font-bold text-red-600 mb-4">Invalid Route</h1>
      <p className="text-gray-600 mb-4">
        The route you're trying to access is not valid.
      </p>
      <a href="/admin" className="text-blue-600 hover:underline">
        Back to Admin Dashboard
      </a>
    </div>
  </div>
);

// Router configuration
export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            Loading...
          </div>
        }
      >
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "/",
    element: <HomeEntry />,
  },
  {
    path: "/material/:materialId",
    element: (
      <ProtectedRoute>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <InstructorsPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/instructor/:instructorId",
    element: (
      <ProtectedRoute>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <InstructorDetailsPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/chapter/:chapterId",
    element: (
      <ProtectedRoute>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <ChapterLecturesPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/chapter/:chapterId/lecture/:lectureId",
    element: (
      <ProtectedRoute>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <LectureContentPage />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute requiredAdmin={true}>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              Loading admin...
            </div>
          }
        >
          <AdminLayout />
        </Suspense>
      </ProtectedRoute>
    ),
    errorElement: <ErrorElement />,
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: "dashboard",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AdminDashboard />
          </Suspense>
        ),
      },
      {
        path: "users",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <UsersManagement />
          </Suspense>
        ),
      },
      {
        path: "content/materials",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <MaterialsList />
          </Suspense>
        ),
      },
      {
        path: "content/materials/:materialId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <MaterialDetail />
          </Suspense>
        ),
      },
      /* Removed duplicate instructors list route (handled under material detail) */
      {
        path: "content/materials/:materialId/instructors/:instructorId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <InstructorDetail />
          </Suspense>
        ),
      },
      {
        path: "content/materials/:materialId/instructors/:instructorId/chapters/:chapterId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ChapterDetail />
          </Suspense>
        ),
      },
      {
        path: "content/materials/:materialId/instructors/:instructorId/chapters/:chapterId/lectures",
        element: <RedirectLecturesToChapter />,
      },
      {
        path: "content/materials/:materialId/instructors/:instructorId/chapters/:chapterId/lectures/:lectureId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <LectureDetail />
          </Suspense>
        ),
      },
      {
        path: "content/lecture/:lectureId",
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AdminLectureRedirect />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;
