import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  LayoutGrid,
  User,
} from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { useBoardStore } from '../lib/stores/board';
import { fetchStarredBoards, fetchRecentBoards } from '../lib/api/boards';
import { fetchActivitiesByBoard, type Activity } from '../lib/api/activities';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import SearchModal from '../components/SearchModal';
import NotificationDropdown from '../components/NotificationDropdown';
import MobileNav, { MobileBottomNav } from '../components/MobileNav';
import { useIsMobile } from '../lib/hooks/useMediaQuery';
import { ThemeToggle } from '../components/ThemeToggle';
import CreateBoardModal from '../components/CreateBoardModal';
import { getActivityDisplay, type ActivityType } from '../lib/api/activities';

// Helper function to get activity label
function getActivityLabel(type: ActivityType): string {
  const display = getActivityDisplay(type);
  return display.label;
}

// Helper function to format activity time
function formatActivityTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { workspaces } = useWorkspaceStore();
  const { addBoard, starredBoards, recentBoards, setStarredBoards, setRecentBoards } = useBoardStore();
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [showStarredDropdown, setShowStarredDropdown] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const isMobile = useIsMobile();

  // Load starred and recent boards on mount
  useEffect(() => {
    const loadBoardData = async () => {
      try {
        const [starred, recent] = await Promise.all([
          fetchStarredBoards(),
          fetchRecentBoards(5),
        ]);
        setStarredBoards(starred);
        setRecentBoards(recent);
      } catch (error) {
        console.error('Failed to load board data:', error);
      }
    };
    loadBoardData();
  }, [setStarredBoards, setRecentBoards]);

  // Load recent activities from boards
  useEffect(() => {
    const loadActivities = async () => {
      if (recentBoards.length === 0) return;

      setLoadingActivities(true);
      try {
        // Fetch activities from the most recent boards (limit to first 3)
        const boardsToFetch = recentBoards.slice(0, 3);
        const activityPromises = boardsToFetch.map(board =>
          fetchActivitiesByBoard(board.id).catch(() => [])
        );
        const allActivities = await Promise.all(activityPromises);

        // Flatten and sort by date
        const flatActivities = allActivities
          .flat()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10); // Show latest 10 activities

        setActivities(flatActivities);
      } catch (error) {
        console.error('Failed to load activities:', error);
      } finally {
        setLoadingActivities(false);
      }
    };
    loadActivities();
  }, [recentBoards]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16 md:pb-0 transition-colors">
      {/* Mobile Navigation */}
      {isMobile && <MobileNav onSearchClick={() => setShowSearch(true)} />}

      {/* Desktop Header */}
      <header className="hidden md:block bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Navigation */}
            <div className="flex items-center space-x-8">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <Layout className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">BoxTasks</span>
              </Link>
              <nav id="main-navigation" className="hidden md:flex items-center space-x-1" aria-label="Main navigation">
                <WorkspaceSwitcher />
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowRecentDropdown(!showRecentDropdown);
                      setShowStarredDropdown(false);
                    }}
                    className="flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    aria-haspopup="menu"
                    aria-expanded={showRecentDropdown}
                  >
                    Recent
                    <ChevronDown className="h-4 w-4 ml-1" aria-hidden="true" />
                  </button>
                  {showRecentDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                      <div className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        Recently Viewed
                      </div>
                      {recentBoards.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                          No recent boards
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {recentBoards.slice(0, 5).map((board) => (
                            <button
                              key={board.id}
                              onClick={() => {
                                navigate(`/board/${board.id}`);
                                setShowRecentDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                            >
                              <div
                                className="w-8 h-6 rounded mr-3 flex-shrink-0"
                                style={{ backgroundColor: board.background || '#0079BF' }}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                {board.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowStarredDropdown(!showStarredDropdown);
                      setShowRecentDropdown(false);
                    }}
                    className="flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    aria-haspopup="menu"
                    aria-expanded={showStarredDropdown}
                  >
                    Starred
                    <ChevronDown className="h-4 w-4 ml-1" aria-hidden="true" />
                  </button>
                  {showStarredDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                      <div className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        Starred Boards
                      </div>
                      {starredBoards.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          <Star className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                          No starred boards
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {starredBoards.map((board) => (
                            <button
                              key={board.id}
                              onClick={() => {
                                navigate(`/board/${board.id}`);
                                setShowStarredDropdown(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
                            >
                              <div
                                className="w-8 h-6 rounded mr-3 flex-shrink-0"
                                style={{ backgroundColor: board.background || '#0079BF' }}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                {board.title}
                              </span>
                              <Star className="h-4 w-4 ml-auto text-yellow-500 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Link
                  to="/everything"
                  className="flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" />
                  Everything
                </Link>
                <Link
                  to="/my-cards"
                  className="flex items-center px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <User className="h-4 w-4 mr-1" aria-hidden="true" />
                  My Cards
                </Link>
                <button
                  onClick={() => setShowCreateBoardModal(true)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center"
                  aria-label="Create new board or workspace"
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Create
                </button>
              </nav>
            </div>

            {/* Search & User */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSearch(true)}
                className="hidden md:flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 w-64 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Search...</span>
                <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded text-gray-500 dark:text-gray-400">⌘K</kbd>
              </button>
              <ThemeToggle />
              <NotificationDropdown />
              <div className="relative group">
                <button className="flex items-center space-x-2" aria-haspopup="menu" aria-expanded="false" aria-label={`User menu for ${user?.displayName || user?.username || 'User'}`}>
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold" aria-hidden="true">
                    {user?.displayName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="font-medium text-gray-900 dark:text-white">{user?.displayName || user?.username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                  </div>
                  <div className="py-1">
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto px-4 py-4 md:py-8" role="main" aria-label="Dashboard content">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Welcome, {user?.displayName || user?.username || 'User'}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Here's what's happening in your workspaces</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Boards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Starred Boards */}
            <section>
              <div className="flex items-center mb-4">
                <Star className="h-5 w-5 text-yellow-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Starred Boards</h2>
              </div>
              {starredBoards.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                  <Star className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Star your favorite boards to access them quickly</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {starredBoards.map((board) => (
                    <Link
                      key={board.id}
                      to={`/board/${board.id}`}
                      className="relative h-24 rounded-lg overflow-hidden hover:opacity-90 transition-opacity group"
                      style={{ backgroundColor: board.background || '#0079BF' }}
                    >
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="relative h-full p-3 flex flex-col justify-between">
                        <h3 className="text-white font-semibold text-sm line-clamp-2">{board.title}</h3>
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Boards */}
            <section>
              <div className="flex items-center mb-4">
                <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recently Viewed</h2>
              </div>
              {recentBoards.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                  <Clock className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No recently viewed boards yet</p>
                  <button
                    onClick={() => setShowCreateBoardModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Create your first board
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {recentBoards.map((board) => (
                    <Link
                      key={board.id}
                      to={`/board/${board.id}`}
                      className="relative h-24 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: board.background || '#0079BF' }}
                    >
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="relative h-full p-3 flex flex-col justify-between">
                        <h3 className="text-white font-semibold text-sm line-clamp-2">{board.title}</h3>
                        <span className="text-white/70 text-xs">
                          {new Date(board.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Workspaces */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Workspaces</h2>
                </div>
                <Link to="/workspaces" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium">
                  View All
                </Link>
              </div>
              {workspaces.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                  <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No workspaces yet</p>
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
                      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md dark:hover:shadow-gray-900/30 transition-shadow"
                    >
                      <div className="flex items-start space-x-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: workspace.color }}
                        >
                          {workspace.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{workspace.title}</h3>
                          {workspace.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{workspace.description}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {workspaces.length > 3 && (
                    <Link
                      to="/workspaces"
                      className="block text-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium py-2"
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
            <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h2>
              <ul className="space-y-3">
                <li>
                  <Link to="/everything" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <LayoutGrid className="h-4 w-4 mr-3" />
                    View all cards
                  </Link>
                </li>
                <li>
                  <Link to="/my-cards" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <User className="h-4 w-4 mr-3" />
                    My cards
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => setShowCreateBoardModal(true)}
                    className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 w-full text-left"
                  >
                    <Layout className="h-4 w-4 mr-3" />
                    Create a board
                  </button>
                </li>
                <li>
                  <a href="#" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <Users className="h-4 w-4 mr-3" />
                    Invite team members
                  </a>
                </li>
                <li>
                  <Link to="/profile" className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    <Settings className="h-4 w-4 mr-3" />
                    Edit profile
                  </Link>
                </li>
              </ul>
            </section>

            {/* Activity Feed */}
            <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity</h2>
              {loadingActivities ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    When you or your team take action, it will show up here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-medium flex-shrink-0">
                        {activity.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white">
                          <span className="font-medium">{activity.authorName}</span>
                          {' '}
                          <span className="text-gray-600 dark:text-gray-400">
                            {getActivityLabel(activity.type)}
                          </span>
                        </p>
                        {activity.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatActivityTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* Search Modal */}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* Create Board Modal */}
      {showCreateBoardModal && (
        <CreateBoardModal
          onClose={() => setShowCreateBoardModal(false)}
          onCreate={(board) => {
            addBoard(board);
            setShowCreateBoardModal(false);
            navigate(`/board/${board.id}`);
          }}
        />
      )}
    </div>
  );
}
