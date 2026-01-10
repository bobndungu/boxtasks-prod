import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Layout, ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Call Drupal's password reset endpoint
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site'}/user/password?_format=json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            mail: email,
          }),
        }
      );

      if (response.ok) {
        setIsSuccess(true);
      } else {
        // Drupal returns 200 even for non-existent emails (security)
        // so we still show success message
        setIsSuccess(true);
      }
    } catch {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <Link to="/" className="flex items-center space-x-2 w-fit">
          <Layout className="h-8 w-8 text-white" />
          <span className="text-2xl font-bold text-white">BoxTasks</span>
        </Link>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          {isSuccess ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
              <p className="text-gray-500 mb-6">
                If an account exists for <strong>{email}</strong>, we've sent password reset instructions.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-6"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to login
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset your password</h1>
              <p className="text-gray-500 mb-8">
                Enter your email address and we'll send you instructions to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                      placeholder="you@example.com"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Send reset instructions'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-blue-200 text-sm">
        © 2024 BoxTasks. All rights reserved.
      </footer>
    </div>
  );
}
