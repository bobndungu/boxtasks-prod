import { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  Bell,
  BarChart3,
  Shield,
} from 'lucide-react';
import { formatDateShort } from '../lib/utils/date';
import { useAuthStore } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { useBoardStore } from '../lib/stores/board';
import { fetchStarredBoards, fetchRecentBoards, prefetchBoard } from '../lib/api/boards';
import { fetchActivitiesByBoard, type Activity, type ActivityData } from '../lib/api/activities';
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

// Helper function to format activity time with full date and relative
function formatActivityTime(dateStr: string): { full: string; relative: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Relative time
  let relative: string;
  if (diffMins < 1) {
    relative = 'Just now';
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    relative = `${diffDays}d ago`;
  } else {
    relative = formatDateShort(date);
  }

  // Full date format with seconds: "Jan 15, 2026, 2:30:45 PM"
  const fullDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ', ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    full: fullDate,
    relative,
  };
}

// Format a date value for display
function formatDateValue(value: string | undefined): string {
  if (!value) return '';
  try {
    const date = new Date(value);
    return formatDateShort(date);
  } catch {
    return value;
  }
}

// Activity diff display component for Dashboard
function ActivityDiffDisplay({ type, data, boardId }: { type: ActivityType; data: ActivityData | null; boardId?: string | null }) {
  if (!data) return null;

  // Card moved - show from/to lists with clickable links to board
  if (type === 'card_moved' && data.from_list && data.to_list) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {boardId ? (
          <Link
            to={`/board/${boardId}`}
            className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-800 dark:hover:text-white cursor-pointer"
            title={`Go to board - ${data.from_list}`}
          >
            {data.from_list}
          </Link>
        ) : (
          <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
            {data.from_list}
          </span>
        )}
        <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
        {boardId ? (
          <Link
            to={`/board/${boardId}`}
            className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/40 cursor-pointer"
            title={`Go to board - ${data.to_list}`}
          >
            {data.to_list}
          </Link>
        ) : (
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
            {data.to_list}
          </span>
        )}
      </div>
    );
  }

  // Date changes - show old/new values
  if ((type === 'due_date_updated' || type === 'start_date_updated') && data.old_value && data.new_value) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded line-through">
          {formatDateValue(data.old_value)}
        </span>
        <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
          {formatDateValue(data.new_value)}
        </span>
      </div>
    );
  }

  // Date set - show new value
  if ((type === 'due_date_set' || type === 'start_date_set') && (data.new_value || data.due_date || data.start_date)) {
    const value = data.new_value || data.due_date || data.start_date;
    return (
      <div className="mt-1.5 text-xs">
        <span className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
          {formatDateValue(value)}
        </span>
      </div>
    );
  }

  // Date removed - show old value
  if ((type === 'due_date_removed' || type === 'start_date_removed') && data.old_value) {
    return (
      <div className="mt-1.5 text-xs">
        <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded line-through">
          {formatDateValue(data.old_value)}
        </span>
      </div>
    );
  }

  // Title change
  if (type === 'title_updated' && data.old_value && data.new_value) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded line-through max-w-[150px] truncate">
          {data.old_value}
        </span>
        <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
        <span className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded max-w-[150px] truncate">
          {data.new_value}
        </span>
      </div>
    );
  }

  // Label changes
  if ((type === 'label_added' || type === 'label_removed') && data.label) {
    const isRemoved = type === 'label_removed';
    return (
      <div className="mt-1.5 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${
          isRemoved
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 line-through'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
        }`}>
          {data.label}
        </span>
      </div>
    );
  }

  // Member changes
  if ((type === 'member_added' || type === 'member_removed') && data.member_name) {
    const isRemoved = type === 'member_removed';
    return (
      <div className="mt-1.5 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${
          isRemoved
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
        }`}>
          {isRemoved ? '−' : '+'} {data.member_name}
        </span>
      </div>
    );
  }

  // Watcher changes
  if ((type === 'watcher_added' || type === 'watcher_removed') && data.watcher_name) {
    const isRemoved = type === 'watcher_removed';
    return (
      <div className="mt-1.5 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${
          isRemoved
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
        }`}>
          {data.watcher_name}
        </span>
      </div>
    );
  }

  return null;
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
  const recentDropdownRef = useRef<HTMLDivElement>(null);
  const starredDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recentDropdownRef.current && !recentDropdownRef.current.contains(event.target as Node)) {
        setShowRecentDropdown(false);
      }
      if (starredDropdownRef.current && !starredDropdownRef.current.contains(event.target as Node)) {
        setShowStarredDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
            <div className="flex items-center space-x-2 lg:space-x-4 xl:space-x-6">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <Layout className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">BoxTasks</span>
              </Link>
              <nav id="main-navigation" className="hidden md:flex items-center space-x-1" aria-label="Main navigation">
                <WorkspaceSwitcher />
                <div className="relative" ref={recentDropdownRef}>
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
                <div className="relative" ref={starredDropdownRef}>
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
                  className="hidden xl:flex items-center px-2 lg:px-3 py-2 text-sm lg:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" />
                  Everything
                </Link>
                <Link
                  to="/my-cards"
                  className="hidden xl:flex items-center px-2 lg:px-3 py-2 text-sm lg:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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
            <div className="flex items-center space-x-2 lg:space-x-4">
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-2 lg:px-3 py-2 w-32 lg:w-40 xl:w-64 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-1 lg:mr-2 flex-shrink-0" />
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">Search...</span>
                <kbd className="ml-auto px-1 lg:px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded text-gray-500 dark:text-gray-400 hidden xl:block">⌘K</kbd>
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
                      <User className="h-4 w-4 mr-3" />
                      Profile
                    </Link>
                    <Link to="/reports" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <BarChart3 className="h-4 w-4 mr-3" />
                      Reports
                    </Link>
                    <Link to="/notifications" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <Bell className="h-4 w-4 mr-3" />
                      Notifications
                    </Link>
                    <Link to="/notifications/settings" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <Bell className="h-4 w-4 mr-3" />
                      Notification Settings
                    </Link>
                    {(user?.uid === 1 || user?.isAdmin || user?.roles?.includes('administrator') || user?.roles?.includes('admin')) && (
                      <>
                        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                        <Link to="/manage/users" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <Users className="h-4 w-4 mr-3" />
                          User Management
                        </Link>
                        <Link to="/manage/roles" className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <Shield className="h-4 w-4 mr-3" />
                          Role Management
                        </Link>
                      </>
                    )}
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
                      onMouseEnter={() => prefetchBoard(board.id)}
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
                      onMouseEnter={() => prefetchBoard(board.id)}
                    >
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="relative h-full p-3 flex flex-col justify-between">
                        <h3 className="text-white font-semibold text-sm line-clamp-2">{board.title}</h3>
                        <span className="text-white/70 text-xs">
                          {formatDateShort(board.updatedAt)}
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
                  <Link
                    to={workspaces.length > 0 ? `/workspace/${workspaces[0].id}/settings` : '/workspaces'}
                    className="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <Users className="h-4 w-4 mr-3" />
                    Invite team members
                  </Link>
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
                  {activities.map((activity) => {
                    const time = formatActivityTime(activity.createdAt);
                    return (
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
                          {/* Show diff visualization if data is available */}
                          <ActivityDiffDisplay type={activity.type} data={activity.data} boardId={activity.boardId} />
                          {/* Show description only if no diff data */}
                          {activity.description && !activity.data && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          {/* Timestamp with full date and relative time - clickable to card */}
                          {activity.cardId && activity.boardId ? (
                            <Link
                              to={`/board/${activity.boardId}?card=${activity.cardId}`}
                              className="text-xs text-gray-400 dark:text-gray-500 mt-1 hover:text-blue-500 dark:hover:text-blue-400 hover:underline cursor-pointer inline-block"
                              title={`${time.full} - Click to view card`}
                            >
                              {time.full} · {time.relative}
                            </Link>
                          ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1" title={time.full}>
                              {time.full} · {time.relative}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
