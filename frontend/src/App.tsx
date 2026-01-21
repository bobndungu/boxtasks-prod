import { useEffect, lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './lib/stores/auth';
import { useThemeStore } from './lib/stores/theme';
import ToastContainer from './components/Toast';
import { ErrorBoundary, BoardErrorBoundary } from './components/ErrorBoundary';
import { SkipLinks } from './components/SkipLinks';
import { PWAUpdatePrompt, OfflineIndicator, PWAInstallPrompt, useVersionCheck } from './components/PWAPrompt';
import { SessionExpiryWarning } from './components/SessionExpiryWarning';
import MentionToastContainer from './components/MentionToastContainer';
import GlobalWorkspaceSubscription from './components/GlobalWorkspaceSubscription';

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
const RoleManagement = lazy(() => import('./pages/RoleManagement'));
const BoardView = lazy(() => import('./pages/BoardView'));
const EverythingView = lazy(() => import('./pages/EverythingView'));
const MyCards = lazy(() => import('./pages/MyCards'));
const Goals = lazy(() => import('./pages/Goals'));
const Milestones = lazy(() => import('./pages/Milestones'));
const WorkspaceReports = lazy(() => import('./pages/WorkspaceReports'));
const MindMapView = lazy(() => import('./pages/MindMapView'));
const BoardReports = lazy(() => import('./pages/BoardReports'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));

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

// Route error boundary component
function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <Suspense fallback={<PageLoader />}>
          <NotFound />
        </Suspense>
      );
    }
  }

  // For other errors, show a generic error page
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-full p-4 w-fit mx-auto mb-6">
          <svg className="h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Refresh Page
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Go to Dashboard
          </a>
        </div>
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

  return (
    <>
      {/* Global workspace subscription for real-time updates */}
      <GlobalWorkspaceSubscription />
      {children}
    </>
  );
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// Root layout with common elements
function RootLayout() {
  // Check for new versions - will auto-reload if new version detected
  useVersionCheck();

  return (
    <>
      <SkipLinks />
      <ToastContainer />
      <PWAUpdatePrompt />
      <OfflineIndicator />
      <MentionToastContainer />
      <PWAInstallPrompt />
      <SessionExpiryWarning />
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}

// Create router with error handling
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Public routes
      { index: true, element: <Home /> },
      { path: 'login', element: <AuthRedirect><Login /></AuthRedirect> },
      { path: 'register', element: <AuthRedirect><Register /></AuthRedirect> },
      { path: 'forgot-password', element: <AuthRedirect><ForgotPassword /></AuthRedirect> },
      { path: 'oauth-callback', element: <OAuthCallback /> },
      // Protected routes
      { path: 'dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
      { path: 'profile', element: <ProtectedRoute><Profile /></ProtectedRoute> },
      { path: 'workspaces', element: <ProtectedRoute><Workspaces /></ProtectedRoute> },
      { path: 'workspace/:id', element: <ProtectedRoute><WorkspaceView /></ProtectedRoute> },
      { path: 'workspace/:id/settings', element: <ProtectedRoute><WorkspaceSettings /></ProtectedRoute> },
      { path: 'workspace/:id/roles', element: <ProtectedRoute><RoleManagement /></ProtectedRoute> },
      {
        path: 'board/:id',
        element: <ProtectedRoute><BoardErrorBoundary><BoardView /></BoardErrorBoundary></ProtectedRoute>
      },
      { path: 'everything', element: <ProtectedRoute><EverythingView /></ProtectedRoute> },
      { path: 'my-cards', element: <ProtectedRoute><MyCards /></ProtectedRoute> },
      { path: 'notifications', element: <ProtectedRoute><Notifications /></ProtectedRoute> },
      { path: 'notifications/settings', element: <ProtectedRoute><NotificationSettings /></ProtectedRoute> },
      { path: 'workspace/:workspaceId/goals', element: <ProtectedRoute><Goals /></ProtectedRoute> },
      { path: 'workspace/:workspaceId/milestones', element: <ProtectedRoute><Milestones /></ProtectedRoute> },
      { path: 'workspace/:workspaceId/reports', element: <ProtectedRoute><WorkspaceReports /></ProtectedRoute> },
      { path: 'board/:boardId/mindmap/:mindMapId', element: <ProtectedRoute><MindMapView /></ProtectedRoute> },
      { path: 'board/:boardId/reports', element: <ProtectedRoute><BoardReports /></ProtectedRoute> },
      { path: 'reports', element: <ProtectedRoute><Reports /></ProtectedRoute> },
      // Admin routes (using /manage to avoid Drupal /admin conflict)
      { path: 'manage/users', element: <ProtectedRoute><AdminUsers /></ProtectedRoute> },
      { path: 'manage/roles', element: <ProtectedRoute><AdminRoles /></ProtectedRoute> },
      // 404 catch-all
      { path: '*', element: <NotFound /> },
    ],
  },
]);

function App() {
  const { checkAuth, isLoading, initSessionMonitoring } = useAuthStore();
  // Initialize theme store on app load - this triggers rehydration and applies the saved theme
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { resolvedTheme: _resolvedTheme } = useThemeStore();

  useEffect(() => {
    checkAuth();
    // Initialize session monitoring after auth check
    const unsubscribe = initSessionMonitoring();
    return () => unsubscribe();
  }, [checkAuth, initSessionMonitoring]);

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
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
