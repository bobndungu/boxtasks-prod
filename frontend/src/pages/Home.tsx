import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout, Users, Zap, LogOut, Settings, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { ThemeToggle } from '../components/ThemeToggle';

interface ApiStatus {
  connected: boolean;
  message: string;
}

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ connected: false, message: 'Checking...' });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    // Test connection to Drupal JSON:API
    const checkApi = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/jsonapi`, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.api+json',
          },
        });
        if (response.ok) {
          setApiStatus({ connected: true, message: 'Connected' });
        } else {
          setApiStatus({ connected: false, message: `API Error: ${response.status}` });
        }
      } catch {
        setApiStatus({ connected: false, message: 'Cannot connect to API' });
      }
    };
    checkApi();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layout className="h-8 w-8 text-white" />
            <span className="text-2xl font-bold text-white">BoxTasks</span>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center text-white hover:text-blue-200 dark:hover:text-blue-300 transition-colors"
                >
                  <LayoutDashboard className="h-5 w-5 mr-1" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                <div className="relative group">
                  <button className="flex items-center space-x-2" aria-haspopup="menu" aria-expanded="false" aria-label={`User menu for ${user?.displayName || user?.username || 'User'}`}>
                    <div className="w-9 h-9 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold border-2 border-white/50 dark:border-gray-600" aria-hidden="true">
                      {user?.displayName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </button>
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="font-medium text-gray-900 dark:text-white">{user?.displayName || user?.username}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link to="/dashboard" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <LayoutDashboard className="h-4 w-4 mr-3" />
                        Dashboard
                      </Link>
                      <Link to="/profile" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <Settings className="h-4 w-4 mr-3" />
                        Profile & Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Log out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-white hover:text-blue-200 dark:hover:text-blue-300 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-colors"
                >
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Organize your work,
            <br />
            <span className="text-blue-200">your way</span>
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            BoxTasks brings all your tasks, teammates, and tools together.
            Keep everything in the same place—even if your team isn't.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors"
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* API Status */}
        <div className="mt-12 flex justify-center">
          <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
            apiStatus.connected ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              apiStatus.connected ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            <span className="text-sm">{apiStatus.message}</span>
          </div>
        </div>
      </main>

      {/* Features */}
      <section id="features" className="bg-white dark:bg-gray-800 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Everything you need to manage projects
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={<Layout className="h-8 w-8 text-blue-600 dark:text-blue-400" />}
              title="Boards & Cards"
              description="Visualize your projects with customizable boards. Drag and drop cards to track progress."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />}
              title="Team Collaboration"
              description="Work together in real-time. Assign tasks, leave comments, and stay in sync."
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-blue-600 dark:text-blue-400" />}
              title="Automation"
              description="Automate repetitive tasks with our powerful automation rules. Focus on what matters."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Layout className="h-6 w-6" />
            <span className="text-xl font-bold text-white">BoxTasks</span>
          </div>
          <p>© {new Date().getFullYear()} BoxTasks. Built by Boxraft Digital.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-700 p-6 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-lg dark:hover:shadow-black/20 transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
}
