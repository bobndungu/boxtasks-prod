import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './lib/stores/auth';
import ToastContainer from './components/Toast';
import { ErrorBoundary, BoardErrorBoundary } from './components/ErrorBoundary';
import { SkipLinks } from './components/SkipLinks';
import { PWAUpdatePrompt, OfflineIndicator, PWAInstallPrompt } from './components/PWAPrompt';

// Lazy loaded pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Workspaces = lazy(() => import('./pages/Workspaces'));
const WorkspaceView = lazy(() => import('./pages/WorkspaceView'));
const WorkspaceSettings = lazy(() => import('./pages/WorkspaceSettings'));
const BoardView = lazy(() => import('./pages/BoardView'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900" role="status" aria-label="Loading page">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400" aria-hidden="true"></div>
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    </div>
  );
}

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-label="Loading authentication">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" aria-hidden="true"></div>
        <span className="sr-only">Loading authentication...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800" role="status" aria-label="Loading application">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" aria-hidden="true"></div>
        <span className="sr-only">Loading BoxTasks application...</span>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SkipLinks />
          <ToastContainer />
          <PWAUpdatePrompt />
          <OfflineIndicator />
          <PWAInstallPrompt />
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
          <Route path="/login" element={<AuthRedirect><Login /></AuthRedirect>} />
          <Route path="/register" element={<AuthRedirect><Register /></AuthRedirect>} />
          <Route path="/forgot-password" element={<AuthRedirect><ForgotPassword /></AuthRedirect>} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces"
            element={
              <ProtectedRoute>
                <Workspaces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/:id"
            element={
              <ProtectedRoute>
                <WorkspaceView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/:id/settings"
            element={
              <ProtectedRoute>
                <WorkspaceSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/board/:id"
            element={
              <ProtectedRoute>
                <BoardErrorBoundary>
                  <BoardView />
                </BoardErrorBoundary>
              </ProtectedRoute>
            }
          />

          {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
