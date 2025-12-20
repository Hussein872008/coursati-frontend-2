import React, { Suspense, lazy } from "react";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth.jsx";
import router from "./router.jsx";
import "./index.css";

const SharedBackground = lazy(() => import("./components/SharedBackground"));
const ToastContainer = lazy(async () => {
  await import("react-toastify/dist/ReactToastify.css");
  const mod = await import("react-toastify");
  return { default: mod.ToastContainer };
});

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <SharedBackground />
      </Suspense>
      <div className="relative z-10">
        <RouterProvider router={router} />
      </div>
      <Suspense fallback={null}>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={true}
          pauseOnHover
        />
      </Suspense>
    </AuthProvider>
  );
}

export default App;
