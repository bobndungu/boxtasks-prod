import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  Layout,
  LayoutGrid,
  User,
  Star,
  Clock,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  Search,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';

interface MobileNavProps {
  onSearchClick: () => void;
}

export default function MobileNav({ onSearchClick }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { workspaces, currentWorkspace } = useWorkspaceStore();
  const location = useLocation();

  const closeNav = () => setIsOpen(false);

  const handleLogout = () => {
    closeNav();
    logout();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <Layout className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold text-gray-900">BoxTasks</span>
        </Link>

        <div className="flex items-center space-x-2">
          <button
            onClick={onSearchClick}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeNav}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div className="absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {user?.displayName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.displayName || user?.username}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={closeNav}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                <Link
                  to="/dashboard"
                  onClick={closeNav}
                  className={`flex items-center px-3 py-2 rounded-lg ${
                    isActive('/dashboard')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Home className="h-5 w-5 mr-3" />
                  Dashboard
                </Link>
                <Link
                  to="/workspaces"
                  onClick={closeNav}
                  className={`flex items-center px-3 py-2 rounded-lg ${
                    isActive('/workspaces')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Users className="h-5 w-5 mr-3" />
                  Workspaces
                </Link>
                <Link
                  to="/everything"
                  onClick={closeNav}
                  className={`flex items-center px-3 py-2 rounded-lg ${
                    isActive('/everything')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <LayoutGrid className="h-5 w-5 mr-3" />
                  Everything
                </Link>
                <Link
                  to="/my-cards"
                  onClick={closeNav}
                  className={`flex items-center px-3 py-2 rounded-lg ${
                    isActive('/my-cards')
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <User className="h-5 w-5 mr-3" />
                  My Cards
                </Link>
              </div>

              {/* Workspaces Section */}
              {workspaces.length > 0 && (
                <div className="mt-6">
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Your Workspaces
                  </h3>
                  <div className="mt-2 space-y-1">
                    {workspaces.map((workspace) => (
                      <Link
                        key={workspace.id}
                        to={`/workspace/${workspace.id}`}
                        onClick={closeNav}
                        className={`flex items-center px-3 py-2 rounded-lg ${
                          currentWorkspace?.id === workspace.id
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold mr-3"
                          style={{ backgroundColor: workspace.color }}
                        >
                          {workspace.title.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 truncate">{workspace.title}</span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Favorites Section */}
              <div className="mt-6">
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Quick Access
                </h3>
                <div className="mt-2 space-y-1">
                  <button className="flex items-center w-full px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                    <Star className="h-5 w-5 mr-3 text-yellow-500" />
                    Starred Boards
                  </button>
                  <button className="flex items-center w-full px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                    <Clock className="h-5 w-5 mr-3 text-gray-400" />
                    Recent Boards
                  </button>
                </div>
              </div>
            </nav>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200 space-y-1">
              <Link
                to="/profile"
                onClick={closeNav}
                className="flex items-center px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="h-5 w-5 mr-3" />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Mobile Bottom Navigation Bar
export function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/my-cards', icon: User, label: 'My Cards' },
    { path: '/workspaces', icon: Users, label: 'Spaces' },
    { path: '/profile', icon: Settings, label: 'Profile' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full ${
                active ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
