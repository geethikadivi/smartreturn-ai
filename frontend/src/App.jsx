import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Purchases from './pages/Purchases';
import UploadInvoice from './pages/UploadInvoice';
import Returns from './pages/Returns';
import WarrantyAlerts from './pages/WarrantyAlerts';
import AiAssistant from './pages/AiAssistant';
import Settings from './pages/Settings';

// Layout wrapper for authenticated dashboard routes
const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Left Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        {/* Top Navbar */}
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Subtle Footer */}
        <footer className="px-6 py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
          SMARTRETURN AI &bull; College-level Product Return, Warranty & Exchange Management SaaS
        </footer>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Purchases />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload-invoice"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <UploadInvoice />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/returns"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Returns />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/warranties"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <WarrantyAlerts />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-assistant"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AiAssistant />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Settings />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
