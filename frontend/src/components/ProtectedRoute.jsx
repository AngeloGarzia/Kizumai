import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh page-bg-dark flex flex-col items-center justify-center gap-4 px-4">
        <div className="flex gap-2">
          <span className="w-3 h-3 rounded-full bg-wasabi-400 animate-pulse" />
          <span className="w-3 h-3 rounded-full bg-topaz-500 animate-pulse [animation-delay:150ms]" />
          <span className="w-3 h-3 rounded-full bg-prune-600 animate-pulse [animation-delay:300ms]" />
        </div>
        <p className="text-prune-300 text-sm">Chargement...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
