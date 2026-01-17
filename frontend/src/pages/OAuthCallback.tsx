import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import { Layout, Loader2, AlertCircle } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setTokens, fetchUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      // Check for error parameter
      const errorParam = searchParams.get('error');
      if (errorParam) {
        setError(getErrorMessage(errorParam));
        return;
      }

      // Get tokens from URL
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');

      if (!accessToken) {
        setError('No access token received. Please try logging in again.');
        return;
      }

      try {
        // Store tokens
        setTokens(accessToken, refreshToken || undefined);

        // Fetch user data
        await fetchUser();

        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('Failed to complete login. Please try again.');
      }
    };

    processCallback();
  }, [searchParams, setTokens, fetchUser, navigate]);

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'not_authenticated':
        return 'Authentication failed. Please try logging in again.';
      case 'user_not_found':
        return 'User account not found.';
      case 'no_consumer':
        return 'OAuth configuration error. Please contact support.';
      case 'token_generation_failed':
        return 'Failed to generate access token. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
        <header className="container mx-auto px-4 py-6">
          <a href="/" className="flex items-center space-x-2 w-fit">
            <Layout className="h-8 w-8 text-white" />
            <span className="text-2xl font-bold text-white">BoxTasks</span>
          </a>
        </header>

        <main className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Login Failed
            </h1>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <div className="flex flex-col gap-3">
              <a
                href="/login"
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Try Again
              </a>
              <a
                href="/"
                className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Go Home
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
      <header className="container mx-auto px-4 py-6">
        <a href="/" className="flex items-center space-x-2 w-fit">
          <Layout className="h-8 w-8 text-white" />
          <span className="text-2xl font-bold text-white">BoxTasks</span>
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="flex justify-center mb-4">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Completing Login
          </h1>
          <p className="text-gray-600">
            Please wait while we finish setting up your session...
          </p>
        </div>
      </main>
    </div>
  );
}
