import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/stores/auth';
import { useBoardStore } from '../lib/stores/board';
import { formatDateShort, formatDateTime as formatDateTimeEAT } from '../lib/utils/date';
import {
  fetchMyCards,
  type GlobalCard,
  type MyCardsFilters,
  type MyCardsStats
} from '../lib/api/globalViews';
import { fetchStarredBoards, fetchRecentBoards } from '../lib/api/boards';
import {
  Layout,
  Plus,
  Star,
  Clock,
  ChevronDown,
  Search,
  LayoutGrid,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Filter,
  SortAsc,
  SortDesc,
  ExternalLink,
  Bell,
  BarChart3,
} from 'lucide-react';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import SearchModal from '../components/SearchModal';
import NotificationDropdown from '../components/NotificationDropdown';
import MobileNav, { MobileBottomNav } from '../components/MobileNav';
import { useIsMobile } from '../lib/hooks/useMediaQuery';
import { ThemeToggle } from '../components/ThemeToggle';
import CreateBoardModal from '../components/CreateBoardModal';

function MyCards() {
  const { user, logout } = useAuthStore();
  const { addBoard, starredBoards, recentBoards, setStarredBoards, setRecentBoards } = useBoardStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [cards, setCards] = useState<GlobalCard[]>([]);
  const [stats, setStats] = useState<MyCardsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header state
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [showStarredDropdown, setShowStarredDropdown] = useState(false);

  // Filters
  const [filters, setFilters] = useState<MyCardsFilters>({
    archived: '0',
    sort: 'due_date',
    order: 'asc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'overdue' | 'today' | 'week' | 'completed'>('all');

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Apply tab filters
      const tabFilters: MyCardsFilters = { ...filters };
      if (selectedTab === 'overdue') {
        tabFilters.dueDate = 'overdue';
        tabFilters.completed = '0';
      } else if (selectedTab === 'today') {
        tabFilters.dueDate = 'today';
        tabFilters.completed = '0';
      } else if (selectedTab === 'week') {
        tabFilters.dueDate = 'week';
        tabFilters.completed = '0';
      } else if (selectedTab === 'completed') {
        tabFilters.completed = '1';
      }

      const response = await fetchMyCards(tabFilters);
      setCards(response.cards);
      setStats(response.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedTab]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Load starred and recent boards for header dropdowns
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

  const updateFilter = <K extends keyof MyCardsFilters>(
    key: K,
    value: MyCardsFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleSort = () => {
    setFilters(prev => ({
      ...prev,
      order: prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cardDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((cardDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, class: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20', isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Today', class: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20', isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', class: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20', isOverdue: false };
    } else if (diffDays <= 7) {
      return { text: `In ${diffDays} days`, class: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20', isOverdue: false };
    } else {
      return { text: formatDateShort(date), class: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800', isOverdue: false };
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    return formatDateTimeEAT(dateStr);
  };

  type TabId = 'all' | 'overdue' | 'today' | 'week' | 'completed';
  const tabs: Array<{ id: TabId; label: string; count: number | undefined; color?: string }> = [
    { id: 'all', label: 'All', count: stats?.total },
    { id: 'overdue', label: 'Overdue', count: stats?.overdue, color: 'text-red-600' },
    { id: 'today', label: 'Today', count: stats?.dueToday, color: 'text-amber-600' },
    { id: 'week', label: 'This Week', count: stats?.dueThisWeek, color: 'text-blue-600' },
    { id: 'completed', label: 'Completed', count: stats?.completed, color: 'text-green-600' },
  ];

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
                  className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 rounded-lg"
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
                      <Settings className="h-4 w-4 mr-3" />
                      Settings
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

      {/* Page-specific sub-header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">My Cards</h1>
              {stats && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {stats.total} total
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  showFilters
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  selectedTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs ${tab.color || ''}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sort By</label>
                <div className="flex items-center gap-1">
                  <select
                    value={filters.sort || 'due_date'}
                    onChange={(e) => updateFilter('sort', e.target.value as MyCardsFilters['sort'])}
                    className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="due_date">Due Date</option>
                    <option value="updated">Last Updated</option>
                    <option value="created">Created</option>
                    <option value="title">Title</option>
                  </select>
                  <button
                    onClick={toggleSort}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    title={filters.order === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {filters.order === 'asc' ? (
                      <SortAsc className="h-4 w-4" />
                    ) : (
                      <SortDesc className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && !loading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Cards</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Overdue</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.dueToday}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Due Today</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.dueThisWeek}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">This Week</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No cards assigned to you</h3>
            <p className="text-gray-500 dark:text-gray-400">
              When you're assigned to cards, they'll appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map(card => (
              <MyCardRow key={card.id} card={card} formatDate={formatDate} formatDateTime={formatDateTime} />
            ))}
          </div>
        )}
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

interface MyCardRowProps {
  card: GlobalCard;
  formatDate: (dateStr: string | null) => { text: string; class: string; isOverdue: boolean } | null;
  formatDateTime: (dateStr: string | null) => string | null;
}

function MyCardRow({ card, formatDate, formatDateTime }: MyCardRowProps) {
  const dueInfo = formatDate(card.dueDate);
  const dueDateTime = formatDateTime(card.dueDate);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-md transition-shadow ${
      dueInfo?.isOverdue && !card.completed
        ? 'border-red-200 dark:border-red-800'
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {card.completed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : dueInfo?.isOverdue ? (
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            ) : null}
            <h4 className={`font-medium ${
              card.completed
                ? 'text-gray-500 dark:text-gray-500 line-through'
                : 'text-gray-900 dark:text-white'
            }`}>
              {card.title}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to={`/board/${card.board.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {card.board.name}
              <ExternalLink className="h-3 w-3" />
            </Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="text-gray-500 dark:text-gray-400">{card.list.name}</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="text-gray-500 dark:text-gray-400">{card.workspace.name}</span>
          </div>

          {card.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {card.description}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          {dueInfo && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${dueInfo.class}`}>
              <Clock className="h-4 w-4" />
              {dueInfo.text}
            </div>
          )}
          {dueDateTime && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {dueDateTime}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MyCards;
