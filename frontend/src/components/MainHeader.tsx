import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layout,
  Plus,
  Star,
  Clock,
  Settings,
  LogOut,
  ChevronDown,
  Search,
  LayoutGrid,
  User,
} from 'lucide-react';
import { useAuthStore } from '../lib/stores/auth';
import { useBoardStore } from '../lib/stores/board';
import { fetchStarredBoards, fetchRecentBoards } from '../lib/api/boards';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import SearchModal from './SearchModal';
import NotificationDropdown from './NotificationDropdown';
import MobileNav, { MobileBottomNav } from './MobileNav';
import { useIsMobile } from '../lib/hooks/useMediaQuery';
import { ThemeToggle } from './ThemeToggle';
import CreateBoardModal from './CreateBoardModal';

interface MainHeaderProps {
  onCreateBoard?: () => void;
  showCreateModal?: boolean;
}

export default function MainHeader({ onCreateBoard, showCreateModal: _externalShowCreateModal }: MainHeaderProps) {
  const { user, logout } = useAuthStore();
  const { addBoard, starredBoards, recentBoards, setStarredBoards, setRecentBoards } = useBoardStore();
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [showStarredDropdown, setShowStarredDropdown] = useState(false);
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

  const handleCreateBoard = () => {
    if (onCreateBoard) {
      onCreateBoard();
    } else {
      setShowCreateBoardModal(true);
    }
  };

  return (
    <>
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
                  onClick={handleCreateBoard}
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

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* Search Modal */}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* Create Board Modal (only if not controlled externally) */}
      {!onCreateBoard && showCreateBoardModal && (
        <CreateBoardModal
          onClose={() => setShowCreateBoardModal(false)}
          onCreate={(board) => {
            addBoard(board);
            setShowCreateBoardModal(false);
            navigate(`/board/${board.id}`);
          }}
        />
      )}
    </>
  );
}
