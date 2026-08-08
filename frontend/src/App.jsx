import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './api/AuthContext';
import Sidebar from './components/Sidebar';

import Login from './pages/auth/Login';
import ChangePassword from './pages/auth/ChangePassword';
import TrainerDashboard from './pages/trainer/Dashboard';
import HodDashboard from './pages/hod/Dashboard';
import IqaDashboard from './pages/iqa/Dashboard';
import DpDashboard from './pages/dp/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import DocumentDetail from './pages/documents/DocumentDetail';
import Profile from './pages/profile/Profile';

const queryClient = new QueryClient();

function ProtectedLayout({ children }) {
  const { capabilities, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-graphite-400">Loading…</div>;
  if (!capabilities) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 max-w-5xl">{children}</main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/trainer" element={<ProtectedLayout><TrainerDashboard /></ProtectedLayout>} />
      <Route path="/hod" element={<ProtectedLayout><HodDashboard /></ProtectedLayout>} />
      <Route path="/iqa" element={<ProtectedLayout><IqaDashboard /></ProtectedLayout>} />
      <Route path="/dp" element={<ProtectedLayout><DpDashboard /></ProtectedLayout>} />
      <Route path="/admin" element={<ProtectedLayout><AdminDashboard /></ProtectedLayout>} />
      <Route path="/documents/:id" element={<ProtectedLayout><DocumentDetail /></ProtectedLayout>} />
      <Route path="/profile" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
      <Route path="/profile/:id" element={<ProtectedLayout><Profile /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/trainer" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
