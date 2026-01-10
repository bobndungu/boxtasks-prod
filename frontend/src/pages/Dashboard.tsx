import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layout,
  Plus,
  Star,
  Clock,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  Search,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import SearchModal from '../components/SearchModal';

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { workspaces } = useWorkspaceStore();
  const [showSearch, setShowSearch] = useState(false);

  // Keyboard shortcut for search (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Navigation */}
            <div className="flex items-center space-x-8">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <Layout className="h-7 w-7 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">BoxTasks</span>
              </Link>
              <nav className="hidden md:flex items-center space-x-1">
                <WorkspaceSwitcher />
                <button className="flex items-center px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  Recent
                  <ChevronDown className="h-4 w-4 ml-1" />
                </button>
                <button className="flex items-center px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                  Starred
                  <ChevronDown className="h-4 w-4 ml-1" />
                </button>
                <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center">
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </button>
              </nav>
            </div>

            {/* Search & User */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSearch(true)}
                className="hidden md:flex items-center bg-gray-100 rounded-lg px-3 py-2 w-64 hover:bg-gray-200 transition-colors"
              >
                <Search className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">Search...</span>
                <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-gray-200 rounded text-gray-500">⌘K</kbd>
              </button>
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="relative group">
                <button className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {user?.displayName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="font-medium text-gray-900">{user?.displayName || user?.username}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link to="/profile" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-50">
                      <Settings className="h-4 w-4 mr-3" />
                      Profile & Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Log out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Welcome, {user?.displayName || user?.username || 'User'}!
          </h1>
          <p className="text-gray-500">Here's what's happening in your workspaces</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Boards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Starred Boards */}
            <section>
              <div className="flex items-center mb-4">
                <Star className="h-5 w-5 text-yellow-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Starred Boards</h2>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <Star className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">Star your favorite boards to access them quickly</p>
              </div>
            </section>

            {/* Recent Boards */}
            <section>
              <div className="flex items-center mb-4">
                <Clock className="h-5 w-5 text-gray-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Recently Viewed</h2>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No recently viewed boards yet</p>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Create your first board
                </button>
              </div>
            </section>

            {/* Workspaces */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-500 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Your Workspaces</h2>
                </div>
                <Link to="/workspaces" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View All
                </Link>
              </div>
              {workspaces.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No workspaces yet</p>
                  <Link
                    to="/workspaces"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Create your first workspace
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {workspaces.slice(0, 3).map((workspace) => (
                    <Link
                      key={workspace.id}
                      to={`/workspace/${workspace.id}`}
                      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start space-x-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: workspace.color }}
                        >
                          {workspace.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{workspace.title}</h3>
                          {workspace.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">{workspace.description}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {workspaces.length > 3 && (
                    <Link
                      to="/workspaces"
                      className="block text-center text-blue-600 hover:text-blue-700 text-sm font-medium py-2"
                    >
                      View all {workspaces.length} workspaces
                    </Link>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right Column - Activity & Links */}
          <div className="space-y-6">
            {/* Quick Links */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="flex items-center text-gray-600 hover:text-blue-600">
                    <Layout className="h-4 w-4 mr-3" />
                    Create a board
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center text-gray-600 hover:text-blue-600">
                    <Users className="h-4 w-4 mr-3" />
                    Invite team members
                  </a>
                </li>
                <li>
                  <Link to="/profile" className="flex items-center text-gray-600 hover:text-blue-600">
                    <Settings className="h-4 w-4 mr-3" />
                    Edit profile
                  </Link>
                </li>
              </ul>
            </section>

            {/* Activity Feed Placeholder */}
            <section className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
              <div className="text-center py-8">
                <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">
                  When you or your team take action, it will show up here
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Search Modal */}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
