import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/user/LoginPage';
import MaterialsPage from './pages/user/MaterialsPage';
import InstructorsPage from './pages/user/InstructorsPage';
import InstructorDetailsPage from './pages/user/InstructorDetailsPage';
import ChapterLecturesPage from './pages/user/ChapterLecturesPage';
import LectureContentPage from './pages/user/LectureContentPage';
import AdminLayout from './layouts/AdminLayout';

// Lazy load admin pages
const UsersManagement = lazy(() => import('./pages/admin/UsersManagement'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const MaterialsList = lazy(() => import('./pages/admin/content/MaterialsList'));
const MaterialDetail = lazy(() => import('./pages/admin/content/MaterialDetail'));
const InstructorDetail = lazy(() => import('./pages/admin/content/InstructorDetail'));
const ChapterDetail = lazy(() => import('./pages/admin/content/ChapterDetail'));
const LectureDetail = lazy(() => import('./pages/admin/content/LectureDetail'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-xl text-gray-600">Loading...</div>
  </div>
);

// Redirect helper to send /.../lectures -> chapter detail (removes duplicate page)
function RedirectLecturesToChapter() {
  const { materialId, instructorId, chapterId } = useParams();
  return <Navigate to={`/admin/content/materials/${materialId}/instructors/${instructorId}/chapters/${chapterId}`} replace />;
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
      <p className="text-gray-600 mb-4">The route you're trying to access is not valid.</p>
      <a href="/admin" className="text-blue-600 hover:underline">
        Back to Admin Dashboard
      </a>
    </div>
  </div>
);

// Router configuration
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MaterialsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/material/:materialId',
    element: (
      <ProtectedRoute>
        <InstructorsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/instructor/:instructorId',
    element: (
      <ProtectedRoute>
        <InstructorDetailsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/chapter/:chapterId',
    element: (
      <ProtectedRoute>
        <ChapterLecturesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/chapter/:chapterId/lecture/:lectureId',
    element: (
      <ProtectedRoute>
        <LectureContentPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredAdmin={true}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorElement />,
    children: [
      {
        index: true,
        element: <Navigate to="dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <AdminDashboard />
          </Suspense>
        ),
      },
      {
        path: 'users',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <UsersManagement />
          </Suspense>
        ),
      },
      {
        path: 'content/materials',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <MaterialsList />
          </Suspense>
        ),
      },
      {
        path: 'content/materials/:materialId',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <MaterialDetail />
          </Suspense>
        ),
      },
      /* Removed duplicate instructors list route (handled under material detail) */
      {
        path: 'content/materials/:materialId/instructors/:instructorId',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <InstructorDetail />
          </Suspense>
        ),
      },
      {
        path: 'content/materials/:materialId/instructors/:instructorId/chapters/:chapterId',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ChapterDetail />
          </Suspense>
        ),
      },
      {
        path: 'content/materials/:materialId/instructors/:instructorId/chapters/:chapterId/lectures',
        element: <RedirectLecturesToChapter />,
      },
      {
        path: 'content/materials/:materialId/instructors/:instructorId/chapters/:chapterId/lectures/:lectureId',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <LectureDetail />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
