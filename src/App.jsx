import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import router from './router.jsx';
import './index.css';
import SharedBackground from './components/SharedBackground.jsx';

function App() {
  return (
    <AuthProvider>
      <SharedBackground />
      <div className="relative z-10">
        <RouterProvider router={router} />
      </div>
    </AuthProvider>
  );
}

export default App;






