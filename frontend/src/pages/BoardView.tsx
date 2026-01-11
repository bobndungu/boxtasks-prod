import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Star,
  Users,
  Plus,
  MoreHorizontal,
  X,
  Loader2,
  ArrowLeft,
  Calendar,
  Tag,
  Trash2,
  GripVertical,
  MessageCircle,
  Send,
  Edit2,
  Paperclip,
  Download,
  FileText,
  Image,
  Upload,
  CheckSquare,
  Check,
  Clock,
  Archive,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Palette,
  Search,
  ArrowRightLeft,
  Eye,
  EyeOff,
  LayoutTemplate,
  Filter,
  SmilePlus,
  UserPlus,
  User,
  Settings,
  Settings2,
  Zap,
  Copy,
  ExternalLink,
  Mail,
  Phone,
  Link2,
  Pin,
  Briefcase,
  Building2,
} from 'lucide-react';
import { useBoardStore } from '../lib/stores/board';
import { fetchBoard, updateBoard, toggleBoardStar, fetchAllBoards, type Board } from '../lib/api/boards';
import { fetchListsByBoard, createList, updateList, deleteList, archiveList, type BoardList } from '../lib/api/lists';
import { fetchCardsByList, createCard, updateCard, deleteCard, uploadCardCover, removeCardCover, watchCard, unwatchCard, assignMember, unassignMember, updateCardDepartment, updateCardClient, type Card, type CardLabel, type CardMember } from '../lib/api/cards';
import { fetchDepartments, fetchClients, type TaxonomyTerm } from '../lib/api/taxonomies';
import { fetchCommentsByCard, createComment, updateComment, deleteComment, toggleReaction, type CardComment, type ReactionType } from '../lib/api/comments';
import { fetchAttachmentsByCard, createAttachment, deleteAttachment, formatFileSize, type CardAttachment } from '../lib/api/attachments';
import { fetchChecklistsByCard, createChecklist, deleteChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem, updateChecklistItemAssignee, countChecklistItems, MAX_NESTING_DEPTH, type Checklist, type ChecklistItem } from '../lib/api/checklists';
import { fetchActivitiesByCard, fetchActivitiesByBoard, getActivityDisplay, type Activity } from '../lib/api/activities';
import { createTemplate, fetchTemplates, type CardTemplate, type ChecklistTemplate } from '../lib/api/templates';
import { createNotification } from '../lib/api/notifications';
import { fetchWorkspaceMembers, type WorkspaceMember } from '../lib/api/workspaces';
import { useKeyboardShortcuts } from '../lib/hooks/useKeyboardShortcuts';
import { useBoardUpdates } from '../lib/hooks/useMercure';
import { usePresence } from '../lib/hooks/usePresence';
import { useOptimistic } from '../lib/hooks/useOptimistic';
import { usePermissions } from '../lib/hooks/usePermissions';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { ActiveUsers } from '../components/ActiveUsers';
import { useAuthStore } from '../lib/stores/auth';
import { toast } from '../lib/stores/toast';
import { CustomFieldsManager } from '../components/CustomFieldsManager';
import { fetchCustomFieldsByBoard, fetchCardCustomFieldValues, setCardCustomFieldValue, enableCardScopedField, disableCardScopedField, getDisplayableFieldsForCard, getAvailableCardScopedFields, type CustomFieldDefinition, type CustomFieldValue } from '../lib/api/customFields';
import { ViewSelector, type ViewType } from '../components/ViewSelector';
import { ViewSettings, DEFAULT_VIEW_SETTINGS, type ViewSettingsData } from '../components/ViewSettings';
import { SavedViews, type SavedView } from '../components/SavedViews';
import CalendarView from '../components/CalendarView';
import TimelineView from '../components/TimelineView';
import TableView from '../components/TableView';
import DashboardView from '../components/DashboardView';
import { AutomationRules } from '../components/AutomationRules';
import { AdvancedFilters, DEFAULT_FILTER_STATE, matchesFilters, type FilterState } from '../components/AdvancedFilters';
import { BoardSkeleton } from '../components/BoardSkeleton';
import { highlightText } from '../lib/utils/highlight';
import BoardSettingsModal from '../components/BoardSettingsModal';
import BoardMembersModal from '../components/BoardMembersModal';
import ChatPanel from '../components/ChatPanel';
import CardRelationships from '../components/CardRelationships';

const LABEL_COLORS: Record<CardLabel, string> = {
  green: '#61bd4f',
  yellow: '#f2d600',
  orange: '#ff9f1a',
  red: '#eb5a46',
  purple: '#c377e0',
  blue: '#0079bf',
};

export default function BoardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBoard, setCurrentBoard, updateBoard: updateBoardInStore } = useBoardStore();
  const { user: currentUser } = useAuthStore();

  // Role-based permissions
  const { canCreate, canEdit, canDelete, canMove } = usePermissions(currentBoard?.workspaceId);

  const [lists, setLists] = useState<BoardList[]>([]);
  const [cardsByList, setCardsByList] = useState<Map<string, Card[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [boardTitle, setBoardTitle] = useState('');
  const [addingListId, setAddingListId] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState('');
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'card' | 'list' | null>(null);
  const [dragSourceListId, setDragSourceListId] = useState<string | null>(null);

  // Board activity sidebar state
  const [showActivitySidebar, setShowActivitySidebar] = useState(false);
  const [boardActivities, setBoardActivities] = useState<Activity[]>([]);

  // List collapse state (stored locally, not persisted)
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());
  const [isLoadingBoardActivities, setIsLoadingBoardActivities] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showBoardMembers, setShowBoardMembers] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Advanced filters state (unified filter panel)
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);

  // Legacy filter aliases for backwards compatibility
  const labelFilter = advancedFilters.labels;
  const memberFilter = advancedFilters.members;
  const setMemberFilter = useCallback((members: string[]) => {
    setAdvancedFilters((prev) => ({ ...prev, members }));
  }, []);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerListId, setTemplatePickerListId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);

  // Workspace members for @mentions
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  // Department and Client taxonomy state
  const [departments, setDepartments] = useState<TaxonomyTerm[]>([]);
  const [clients, setClients] = useState<TaxonomyTerm[]>([]);

  // Custom fields manager state
  const [showCustomFields, setShowCustomFields] = useState(false);

  // Automation rules state
  const [showAutomationRules, setShowAutomationRules] = useState(false);

  // Custom field data for cards display
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Map<string, CustomFieldValue[]>>(new Map());

  // Custom field filter alias for backwards compatibility
  const customFieldFilter = advancedFilters.customFields;

  // View switching state
  const [currentView, setCurrentView] = useState<ViewType>('kanban');
  const [viewSettings, setViewSettings] = useState<ViewSettingsData>(DEFAULT_VIEW_SETTINGS);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Field visibility settings
  interface CardFieldVisibility {
    labels: boolean;
    startDate: boolean;
    dueDate: boolean;
    members: boolean;
    customFields: boolean;
    expanded: boolean; // Show expanded card view with more details
  }

  const defaultFieldVisibility: CardFieldVisibility = {
    labels: true,
    startDate: true,
    dueDate: true,
    members: true,
    customFields: true,
    expanded: false,
  };

  const [fieldVisibility, setFieldVisibility] = useState<CardFieldVisibility>(() => {
    if (!id) return defaultFieldVisibility;
    const stored = localStorage.getItem(`boxtasks_field_visibility_${id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle missing properties
        return { ...defaultFieldVisibility, ...parsed };
      } catch {
        return defaultFieldVisibility;
      }
    }
    return defaultFieldVisibility;
  });

  const [showFieldVisibilityMenu, setShowFieldVisibilityMenu] = useState(false);

  // Save field visibility to localStorage
  useEffect(() => {
    if (id) {
      localStorage.setItem(`boxtasks_field_visibility_${id}`, JSON.stringify(fieldVisibility));
    }
  }, [fieldVisibility, id]);

  // Load saved views from localStorage and parse URL params
  useEffect(() => {
    if (!id) return;

    // Load saved views from localStorage
    const savedViewsKey = `boxtasks_saved_views_${id}`;
    const storedViews = localStorage.getItem(savedViewsKey);
    if (storedViews) {
      try {
        const views = JSON.parse(storedViews) as SavedView[];
        setSavedViews(views);

        // Apply default view if exists and no URL params
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has('view')) {
          const defaultView = views.find((v) => v.isDefault);
          if (defaultView) {
            setCurrentView(defaultView.viewType);
            setViewSettings(defaultView.settings);
          }
        }
      } catch (e) {
        console.error('Failed to parse saved views:', e);
      }
    }

    // Parse URL params for shared view
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view') as ViewType | null;
    const settingsParam = urlParams.get('settings');

    if (viewParam && ['kanban', 'calendar', 'timeline', 'table', 'dashboard'].includes(viewParam)) {
      setCurrentView(viewParam);

      if (settingsParam) {
        try {
          const decodedSettings = JSON.parse(atob(settingsParam)) as ViewSettingsData;
          setViewSettings(decodedSettings);
        } catch (e) {
          console.error('Failed to parse view settings from URL:', e);
        }
      }

      // Clean URL params after applying
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [id]);

  // Save views to localStorage when changed
  useEffect(() => {
    if (!id || savedViews.length === 0) return;
    const savedViewsKey = `boxtasks_saved_views_${id}`;
    localStorage.setItem(savedViewsKey, JSON.stringify(savedViews));
  }, [id, savedViews]);

  // Handlers for saved views
  const handleSaveView = (name: string, isDefault: boolean, includeFilters: boolean) => {
    const newView: SavedView = {
      id: crypto.randomUUID(),
      name,
      viewType: currentView,
      settings: viewSettings,
      filters: includeFilters ? advancedFilters : undefined,
      isDefault,
      createdAt: new Date().toISOString(),
    };

    setSavedViews((prev) => {
      // If setting as default, remove default from others
      const updated = isDefault
        ? prev.map((v) => ({ ...v, isDefault: false }))
        : prev;
      return [...updated, newView];
    });

    const filterMsg = includeFilters ? ' (with filters)' : '';
    toast.success(`View "${name}" saved${filterMsg}`);
  };

  const handleLoadView = (view: SavedView) => {
    setCurrentView(view.viewType);
    setViewSettings(view.settings);
    // Apply saved filters if present
    if (view.filters) {
      setAdvancedFilters(view.filters);
    }
    const filterMsg = view.filters ? ' with filters' : '';
    toast.success(`Loaded view "${view.name}"${filterMsg}`);
  };

  const handleDeleteView = (viewId: string) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
    toast.success('View deleted');
  };

  const handleSetDefaultView = (viewId: string | null) => {
    setSavedViews((prev) =>
      prev.map((v) => ({
        ...v,
        isDefault: v.id === viewId,
      }))
    );
    if (viewId) {
      const view = savedViews.find((v) => v.id === viewId);
      toast.success(`"${view?.name}" set as default view`);
    } else {
      toast.success('Default view removed');
    }
  };

  // Optimistic UI updates
  const cardOptimistic = useOptimistic<Map<string, Card[]>>();
  const listOptimistic = useOptimistic<BoardList[]>();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'n', action: () => {
      // Add card to first list
      if (lists.length > 0 && !addingCardToList) {
        setAddingCardToList(lists[0].id);
      }
    }, description: 'New card' },
    { key: 'l', action: () => {
      if (!addingListId) {
        setAddingListId('new');
      }
    }, description: 'New list' },
    { key: 'a', action: () => toggleActivitySidebar(), description: 'Toggle activity' },
    { key: '/', action: () => {
      setShowSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }, description: 'Search cards' },
    { key: 'm', action: () => {
      if (currentUser) {
        if (memberFilter.length === 1 && memberFilter[0] === currentUser.id) {
          setMemberFilter([]);
        } else {
          setMemberFilter([currentUser.id]);
        }
      }
    }, description: 'My cards' },
    { key: 'Escape', action: () => {
      if (selectedCard) {
        setSelectedCard(null);
      } else if (showSearch && searchQuery) {
        setSearchQuery('');
        setShowSearch(false);
      } else if (showKeyboardHelp) {
        setShowKeyboardHelp(false);
      } else if (showActivitySidebar) {
        setShowActivitySidebar(false);
      } else if (addingCardToList) {
        setAddingCardToList(null);
        setNewCardTitle('');
      } else if (addingListId) {
        setAddingListId(null);
        setNewListTitle('');
      }
    }, description: 'Close/Cancel' },
    { key: '?', action: () => setShowKeyboardHelp(!showKeyboardHelp), description: 'Toggle help' },
  ], !selectedCard);

  // Real-time updates via Mercure
  const mercureConnection = useBoardUpdates(id, {
    onCardCreated: (cardData) => {
      const card = cardData as Card;
      if (card.listId) {
        setCardsByList((prev) => {
          const newMap = new Map(prev);
          const listCards = newMap.get(card.listId) || [];
          // Only add if not already present (check by ID and also by temp ID pattern for optimistic cards)
          const existingByRealId = listCards.some((c) => c.id === card.id);
          const existingTempCard = listCards.some((c) =>
            c.id.startsWith('temp_') && c.title === card.title && c.listId === card.listId
          );
          if (!existingByRealId) {
            if (existingTempCard) {
              // Replace temp card with real card
              newMap.set(card.listId, listCards.map((c) =>
                (c.id.startsWith('temp_') && c.title === card.title) ? card : c
              ));
            } else {
              newMap.set(card.listId, [...listCards, card]);
            }
          }
          return newMap;
        });
        // Only show toast if this wasn't an optimistic update from this user
        // (real-time updates from other users should show toast)
      }
    },
    onCardUpdated: (cardData) => {
      const card = cardData as Card;
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        for (const [listId, cards] of newMap.entries()) {
          const index = cards.findIndex((c) => c.id === card.id);
          if (index !== -1) {
            const newCards = [...cards];
            newCards[index] = card;
            // Sort by position to handle reordering within the list
            newCards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            newMap.set(listId, newCards);
            break;
          }
        }
        return newMap;
      });
      // Update selected card if it's being viewed
      if (selectedCard?.id === card.id) {
        setSelectedCard(card);
      }
    },
    onCardDeleted: (cardId) => {
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        for (const [listId, cards] of newMap.entries()) {
          const filtered = cards.filter((c) => c.id !== cardId);
          if (filtered.length !== cards.length) {
            newMap.set(listId, filtered);
            break;
          }
        }
        return newMap;
      });
      // Close modal if the deleted card was selected
      if (selectedCard?.id === cardId) {
        setSelectedCard(null);
        toast.info('This card was deleted');
      }
    },
    onCardMoved: (moveData) => {
      const { cardId, fromListId, toListId, position } = moveData;
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        // Remove from source list
        const sourceCards = newMap.get(fromListId) || [];
        const cardIndex = sourceCards.findIndex((c) => c.id === cardId);
        if (cardIndex !== -1) {
          const [card] = sourceCards.splice(cardIndex, 1);
          newMap.set(fromListId, sourceCards);
          // Add to destination list
          const destCards = newMap.get(toListId) || [];
          card.listId = toListId;
          destCards.splice(position, 0, card);
          newMap.set(toListId, destCards);
        }
        return newMap;
      });
    },
    onListCreated: (listData) => {
      const list = listData as BoardList;
      setLists((prev) => {
        // Check if real ID already exists
        if (prev.some((l) => l.id === list.id)) {
          return prev;
        }
        // Check if there's a temp list with matching title that should be replaced
        const tempListIndex = prev.findIndex(
          (l) => l.id.startsWith('temp_list_') && l.title === list.title
        );
        if (tempListIndex !== -1) {
          // Replace temp list with real list
          const updated = [...prev];
          updated[tempListIndex] = list;
          return updated;
        }
        // No temp list found, add the new list
        return [...prev, list];
      });
      setCardsByList((prev) => {
        // Check if there's a temp list entry that should be replaced
        const tempEntry = Array.from(prev.entries()).find(
          ([key]) => key.startsWith('temp_list_')
        );
        if (tempEntry && !prev.has(list.id)) {
          const newMap = new Map(prev);
          const cards = tempEntry[1];
          newMap.delete(tempEntry[0]);
          newMap.set(list.id, cards);
          return newMap;
        }
        if (!prev.has(list.id)) {
          const newMap = new Map(prev);
          newMap.set(list.id, []);
          return newMap;
        }
        return prev;
      });
      toast.info(`List "${list.title}" was created`);
    },
    onListUpdated: (listData) => {
      const list = listData as BoardList;
      setLists((prev) => {
        const updated = prev.map((l) => (l.id === list.id ? list : l));
        // Sort by position to handle reordering
        return updated.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      });
    },
    onListDeleted: (listId) => {
      setLists((prev) => prev.filter((l) => l.id !== listId));
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        newMap.delete(listId);
        return newMap;
      });
    },
    onListReordered: (listPositions) => {
      // Batch reorder lists based on position mapping
      setLists((prev) => {
        const updated = prev.map((list) => ({
          ...list,
          position: listPositions[list.id] ?? list.position,
        }));
        return updated.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      });
    },
    onCardReordered: (reorderData) => {
      // Batch reorder cards within a list based on position mapping
      const { listId, cardPositions } = reorderData;
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        const listCards = newMap.get(listId);
        if (listCards) {
          const updated = listCards.map((card) => ({
            ...card,
            position: cardPositions[card.id] ?? card.position,
          }));
          updated.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          newMap.set(listId, updated);
        }
        return newMap;
      });
    },
    onCommentCreated: (commentData) => {
      // Show a subtle notification for new comments
      const comment = commentData as { cardTitle?: string };
      if (comment.cardTitle) {
        toast.info(`New comment on "${comment.cardTitle}"`);
      }
    },
    onPresenceUpdate: (presenceData) => {
      // Handle presence updates via usePresence hook
      handlePresenceUpdate(presenceData);
    },
  });

  // User presence tracking
  const { activeUsers, handlePresenceUpdate } = usePresence({ boardId: id, enabled: !!id });

  // Helper function to sort cards: pinned first, then by position
  const sortCards = useCallback((cards: Card[]): Card[] => {
    return [...cards].sort((a, b) => {
      // Pinned cards first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then by position
      return (a.position ?? 0) - (b.position ?? 0);
    });
  }, []);

  // Filter cards based on search query and advanced filters
  const filteredCardsByList = useMemo(() => {
    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasAdvancedFilters =
      advancedFilters.labels.length > 0 ||
      advancedFilters.members.length > 0 ||
      advancedFilters.dueDateFilter !== null ||
      advancedFilters.completionStatus !== null ||
      advancedFilters.customFields.length > 0;

    // Apply sorting to all cards (pinned first, then by position)
    const sortedCardsByList = new Map<string, Card[]>();
    for (const [listId, cards] of cardsByList.entries()) {
      sortedCardsByList.set(listId, sortCards(cards));
    }

    if (!hasSearchQuery && !hasAdvancedFilters) return sortedCardsByList;

    const query = searchQuery.toLowerCase();
    const filtered = new Map<string, Card[]>();

    for (const [listId, cards] of sortedCardsByList.entries()) {
      const matchingCards = cards.filter((card) => {
        // Check search query
        const matchesSearch = !hasSearchQuery ||
          card.title.toLowerCase().includes(query) ||
          (card.description && card.description.toLowerCase().includes(query));

        if (!matchesSearch) return false;

        // Use the matchesFilters helper for advanced filters
        const cardCfValues = customFieldValues.get(card.id) || [];
        return matchesFilters(
          {
            labels: card.labels,
            memberIds: card.memberIds,
            dueDate: card.dueDate,
            completed: card.completed,
          },
          advancedFilters,
          cardCfValues.map((v) => ({ definitionId: v.definitionId, value: v.value })),
          customFieldDefs
        );
      });
      filtered.set(listId, matchingCards);
    }

    return filtered;
  }, [cardsByList, searchQuery, advancedFilters, customFieldValues, customFieldDefs, sortCards]);

  // Flat array of all filtered cards for alternative views
  const allFilteredCards = useMemo(() => {
    return Array.from(filteredCardsByList.values()).flat();
  }, [filteredCardsByList]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (id) {
      loadBoardData();
    }
  }, [id]);

  // Keyboard shortcut for search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  const loadBoardData = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const board = await fetchBoard(id);
      setCurrentBoard(board);
      setBoardTitle(board.title);

      const boardLists = await fetchListsByBoard(id);
      setLists(boardLists);

      const cardsMap = new Map<string, Card[]>();
      for (const list of boardLists) {
        const cards = await fetchCardsByList(list.id);
        cardsMap.set(list.id, cards);
      }
      setCardsByList(cardsMap);

      // Load custom field definitions for the board
      try {
        const fieldDefs = await fetchCustomFieldsByBoard(id);
        setCustomFieldDefs(fieldDefs);

        // Load custom field values for all cards
        if (fieldDefs.length > 0) {
          const allCards = Array.from(cardsMap.values()).flat();
          const valuesMap = new Map<string, CustomFieldValue[]>();
          for (const card of allCards) {
            const values = await fetchCardCustomFieldValues(card.id);
            if (values.length > 0) {
              valuesMap.set(card.id, values);
            }
          }
          setCustomFieldValues(valuesMap);
        }
      } catch (cfErr) {
        console.error('Failed to load custom fields:', cfErr);
      }

      // Load workspace members for @mentions
      if (board.workspaceId) {
        try {
          const members = await fetchWorkspaceMembers(board.workspaceId);
          setWorkspaceMembers(members);
        } catch (memberErr) {
          console.error('Failed to load workspace members:', memberErr);
        }
      }

      // Load taxonomy terms for Department and Client dropdowns
      try {
        const [depts, clnts] = await Promise.all([
          fetchDepartments(),
          fetchClients(),
        ]);
        setDepartments(depts);
        setClients(clnts);
      } catch (taxErr) {
        console.error('Failed to load taxonomy terms:', taxErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTitleSave = async () => {
    if (!id || !boardTitle.trim() || boardTitle === currentBoard?.title) {
      setEditingTitle(false);
      setBoardTitle(currentBoard?.title || '');
      return;
    }

    try {
      const updated = await updateBoard(id, { title: boardTitle });
      setCurrentBoard(updated);
      setEditingTitle(false);
    } catch {
      setBoardTitle(currentBoard?.title || '');
      setEditingTitle(false);
    }
  };

  const handleToggleStar = async () => {
    if (!id || !currentBoard) return;
    try {
      const updated = await toggleBoardStar(id, !currentBoard.starred);
      setCurrentBoard(updated);
    } catch {
      // Silent fail
    }
  };

  const handleAddList = async () => {
    if (!id || !newListTitle.trim()) {
      setAddingListId(null);
      setNewListTitle('');
      return;
    }

    const tempId = `temp_list_${Date.now()}`;
    const titleToCreate = newListTitle;

    // Create temporary optimistic list
    const tempList: BoardList = {
      id: tempId,
      title: titleToCreate,
      boardId: id,
      position: lists.length,
      archived: false,
      wipLimit: 0,
      color: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Clear form immediately for better UX
    setNewListTitle('');
    setAddingListId(null);

    // Add empty card array for the temp list
    setCardsByList((prev) => new Map(prev).set(tempId, []));

    // Execute with optimistic update
    await listOptimistic.execute({
      currentState: lists,
      optimisticUpdate: (current) => [...current, tempList],
      apiCall: () => createList({
        title: titleToCreate,
        boardId: id,
        position: lists.length,
      }),
      onSuccess: (newList) => {
        // Replace temp list with real list from server
        setLists((prev) => prev.map((l) => (l.id === tempId ? newList : l)));
        // Update cardsByList with the real list id
        setCardsByList((prev) => {
          const newMap = new Map(prev);
          const cards = newMap.get(tempId) || [];
          newMap.delete(tempId);
          newMap.set(newList.id, cards);
          return newMap;
        });
      },
      rollbackState: (prevLists) => {
        setLists(prevLists);
        // Also remove the temp cards entry
        setCardsByList((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
      },
      options: { errorMessage: 'Failed to create list' },
    });
  };

  const handleAddCard = async (listId: string) => {
    if (!newCardTitle.trim()) {
      setAddingCardToList(null);
      setNewCardTitle('');
      return;
    }

    const listCards = cardsByList.get(listId) || [];
    const tempId = `temp_${Date.now()}`;
    const titleToCreate = newCardTitle;

    // Calculate position after pinned cards (new cards go to top, after pinned)
    const pinnedCount = listCards.filter(c => c.pinned).length;

    // Create temporary optimistic card
    const tempCard: Card = {
      id: tempId,
      title: titleToCreate,
      listId,
      position: pinnedCount, // Position after pinned cards (at top of non-pinned)
      labels: [],
      archived: false,
      completed: false,
      pinned: false,
      watcherIds: [],
      memberIds: [],
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      commentCount: 0,
      attachmentCount: 0,
      checklistCompleted: 0,
      checklistTotal: 0,
    };

    // Clear form immediately for better UX
    setNewCardTitle('');
    setAddingCardToList(null);

    // Execute with optimistic update
    await cardOptimistic.execute({
      currentState: cardsByList,
      optimisticUpdate: (current) => {
        const newMap = new Map(current);
        const cards = [...(newMap.get(listId) || [])];
        // Insert after pinned cards (at the top of non-pinned cards)
        cards.splice(pinnedCount, 0, tempCard);
        newMap.set(listId, cards);
        return newMap;
      },
      apiCall: async () => {
        // Auto-set due date to +5 minutes from now
        const autodueDueDate = new Date();
        autodueDueDate.setMinutes(autodueDueDate.getMinutes() + 5);

        // Create the new card at the top (after pinned cards)
        const newCard = await createCard({
          title: titleToCreate,
          listId,
          position: pinnedCount, // Position after pinned cards (at top of non-pinned)
          dueDate: autodueDueDate.toISOString(),
          creatorId: currentUser?.id, // Auto-assign creator
        });

        // Update positions of other cards (shift them down)
        const existingNonPinnedCards = listCards.filter(c => !c.pinned);
        await Promise.all(
          existingNonPinnedCards.map((card, index) =>
            updateCard(card.id, { position: pinnedCount + 1 + index })
          )
        );

        return newCard;
      },
      onSuccess: (newCard) => {
        // Replace temp card with real card from server (or skip if Mercure already added it)
        setCardsByList((prev) => {
          const newMap = new Map(prev);
          const cards = newMap.get(listId) || [];
          // Check if the real card already exists (added by Mercure)
          const realCardExists = cards.some((c) => c.id === newCard.id);
          if (realCardExists) {
            // Mercure already added it, just remove the temp card if it exists
            newMap.set(listId, cards.filter((c) => c.id !== tempId));
          } else {
            // Replace temp card with real card
            newMap.set(listId, cards.map((c) => (c.id === tempId ? newCard : c)));
          }
          return newMap;
        });
      },
      rollbackState: setCardsByList,
      options: { errorMessage: 'Failed to create card' },
    });
  };

  const handleOpenTemplatePicker = async (listId: string) => {
    setTemplatePickerListId(listId);
    setShowTemplatePicker(true);
    setIsLoadingTemplates(true);
    try {
      const allTemplates = await fetchTemplates();
      setTemplates(allTemplates);
    } catch (err) {
      console.error('Failed to load templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleCreateFromTemplate = async (template: CardTemplate) => {
    if (!templatePickerListId) return;

    setIsCreatingFromTemplate(true);
    try {
      const listCards = cardsByList.get(templatePickerListId) || [];

      // Calculate position after pinned cards (new cards go to top, after pinned)
      const pinnedCount = listCards.filter(c => c.pinned).length;

      // Auto-set due date to +5 minutes from now
      const autoDueDate = new Date();
      autoDueDate.setMinutes(autoDueDate.getMinutes() + 5);

      // Create the card with template data
      const newCard = await createCard({
        title: template.title,
        listId: templatePickerListId,
        description: template.description,
        labels: template.labels.length > 0 ? template.labels : undefined,
        position: pinnedCount, // Position after pinned cards (at top of non-pinned)
        dueDate: autoDueDate.toISOString(),
        creatorId: currentUser?.id, // Auto-assign creator
      });

      // Update positions of other cards (shift them down)
      const existingNonPinnedCards = listCards.filter(c => !c.pinned);
      await Promise.all(
        existingNonPinnedCards.map((card, index) =>
          updateCard(card.id, { position: pinnedCount + 1 + index })
        )
      );

      // Create checklists from template (auto-assign items to card creator)
      for (const checklistTemplate of template.checklists) {
        const checklist = await createChecklist(newCard.id, checklistTemplate.title);
        // Create checklist items with card creator as assignee
        for (let i = 0; i < checklistTemplate.items.length; i++) {
          await createChecklistItem(checklist.id, checklistTemplate.items[i].title, i, undefined, currentUser?.id);
        }
      }

      // Update the cards map - insert after pinned cards (at top of non-pinned)
      const newCardsMap = new Map(cardsByList);
      const updatedCards = [...listCards];
      updatedCards.splice(pinnedCount, 0, newCard);
      newCardsMap.set(templatePickerListId, updatedCards);
      setCardsByList(newCardsMap);

      setShowTemplatePicker(false);
      setTemplatePickerListId(null);
      toast.success(`Card created from template "${template.title}"`);
    } catch (err) {
      console.error('Failed to create card from template:', err);
      toast.error('Failed to create card from template');
    } finally {
      setIsCreatingFromTemplate(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    // Store cards for potential rollback
    const cardsToRestore = cardsByList.get(listId) || [];

    // Optimistically remove from cards map
    setCardsByList((prev) => {
      const newMap = new Map(prev);
      newMap.delete(listId);
      return newMap;
    });

    await listOptimistic.execute({
      currentState: lists,
      optimisticUpdate: (current) => current.filter((l) => l.id !== listId),
      apiCall: () => deleteList(listId),
      rollbackState: (prevLists) => {
        setLists(prevLists);
        // Restore cards
        setCardsByList((prev) => new Map(prev).set(listId, cardsToRestore));
      },
      options: { errorMessage: 'Failed to delete list' },
    });
  };

  const handleArchiveList = async (listId: string) => {
    // Store cards for potential rollback
    const cardsToRestore = cardsByList.get(listId) || [];

    // Optimistically remove from cards map
    setCardsByList((prev) => {
      const newMap = new Map(prev);
      newMap.delete(listId);
      return newMap;
    });

    await listOptimistic.execute({
      currentState: lists,
      optimisticUpdate: (current) => current.filter((l) => l.id !== listId),
      apiCall: () => archiveList(listId),
      rollbackState: (prevLists) => {
        setLists(prevLists);
        // Restore cards
        setCardsByList((prev) => new Map(prev).set(listId, cardsToRestore));
      },
      options: { errorMessage: 'Failed to archive list' },
    });
  };

  const handleUpdateList = async (listId: string, data: { title?: string; wipLimit?: number; color?: string | null }) => {
    try {
      const updated = await updateList(listId, data);
      setLists(lists.map((l) => (l.id === listId ? updated : l)));
    } catch {
      setError('Failed to update list');
    }
  };

  const toggleListCollapse = (listId: string) => {
    setCollapsedLists((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
  };

  const handleCardUpdate = async (cardId: string, updates: Partial<Card>) => {
    try {
      const updated = await updateCard(cardId, updates);
      const newCardsMap = new Map(cardsByList);
      const listCards = newCardsMap.get(updated.listId) || [];
      newCardsMap.set(
        updated.listId,
        listCards.map((c) => (c.id === cardId ? updated : c))
      );
      setCardsByList(newCardsMap);
      setSelectedCard(updated);
    } catch {
      setError('Failed to update card');
    }
  };

  const handleDeleteCard = async (card: Card) => {
    if (!confirm('Delete this card?')) return;

    try {
      await deleteCard(card.id);
      const newCardsMap = new Map(cardsByList);
      const listCards = newCardsMap.get(card.listId) || [];
      newCardsMap.set(
        card.listId,
        listCards.filter((c) => c.id !== card.id)
      );
      setCardsByList(newCardsMap);
      setSelectedCard(null);
    } catch {
      setError('Failed to delete card');
    }
  };

  const handleArchiveCard = async (card: Card) => {
    try {
      await updateCard(card.id, { archived: true });
      const newCardsMap = new Map(cardsByList);
      const listCards = newCardsMap.get(card.listId) || [];
      newCardsMap.set(
        card.listId,
        listCards.filter((c) => c.id !== card.id)
      );
      setCardsByList(newCardsMap);
      setSelectedCard(null);
    } catch {
      setError('Failed to archive card');
    }
  };

  // Quick action handlers for cards (no modal) - with optimistic updates
  const handleQuickComplete = async (card: Card) => {
    const newCompleted = !card.completed;

    await cardOptimistic.execute({
      currentState: cardsByList,
      optimisticUpdate: (current) => {
        const newMap = new Map(current);
        const listCards = newMap.get(card.listId) || [];
        newMap.set(
          card.listId,
          listCards.map((c) => (c.id === card.id ? { ...c, completed: newCompleted } : c))
        );
        return newMap;
      },
      apiCall: () => updateCard(card.id, { completed: newCompleted }),
      onSuccess: (updated) => {
        // Update with real server data
        setCardsByList((prev) => {
          const newMap = new Map(prev);
          const listCards = newMap.get(card.listId) || [];
          newMap.set(
            card.listId,
            listCards.map((c) => (c.id === card.id ? updated : c))
          );
          return newMap;
        });
      },
      rollbackState: setCardsByList,
      options: { errorMessage: 'Failed to update card' },
    });
  };

  const handleQuickArchive = async (card: Card) => {
    await cardOptimistic.execute({
      currentState: cardsByList,
      optimisticUpdate: (current) => {
        const newMap = new Map(current);
        const listCards = newMap.get(card.listId) || [];
        newMap.set(
          card.listId,
          listCards.filter((c) => c.id !== card.id)
        );
        return newMap;
      },
      apiCall: () => updateCard(card.id, { archived: true }),
      rollbackState: setCardsByList,
      options: { errorMessage: 'Failed to archive card' },
    });
  };

  const handleCopyCard = async (card: Card) => {
    try {
      const listCards = cardsByList.get(card.listId) || [];

      // Calculate position after pinned cards (copied cards go to top, after pinned)
      const pinnedCount = listCards.filter(c => c.pinned).length;

      // Auto-set due date to +5 minutes from now for copied cards
      const autoDueDate = new Date();
      autoDueDate.setMinutes(autoDueDate.getMinutes() + 5);

      const newCard = await createCard({
        title: `${card.title} (copy)`,
        listId: card.listId,
        description: card.description,
        position: pinnedCount, // Position after pinned cards (at top of non-pinned)
        labels: card.labels,
        dueDate: autoDueDate.toISOString(),
        creatorId: currentUser?.id, // Auto-assign creator
      });

      // Update positions of other cards (shift them down)
      const existingNonPinnedCards = listCards.filter(c => !c.pinned);
      await Promise.all(
        existingNonPinnedCards.map((c, index) =>
          updateCard(c.id, { position: pinnedCount + 1 + index })
        )
      );

      const newCardsMap = new Map(cardsByList);
      // Insert after pinned cards (at top of non-pinned)
      const updatedCards = [...listCards];
      updatedCards.splice(pinnedCount, 0, newCard);
      newCardsMap.set(card.listId, updatedCards);
      setCardsByList(newCardsMap);
      setSelectedCard(newCard);
    } catch {
      setError('Failed to copy card');
    }
  };

  const loadBoardActivities = async () => {
    if (!id) return;
    setIsLoadingBoardActivities(true);
    try {
      const activities = await fetchActivitiesByBoard(id);
      setBoardActivities(activities);
    } catch {
      console.error('Failed to load board activities');
    } finally {
      setIsLoadingBoardActivities(false);
    }
  };

  const toggleActivitySidebar = () => {
    const newState = !showActivitySidebar;
    setShowActivitySidebar(newState);
    if (newState && boardActivities.length === 0) {
      loadBoardActivities();
    }
  };

  const formatBoardActivityTime = (dateStr: string) => {
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Find which list a card belongs to
  const findListContainingCard = useCallback((cardId: string): string | null => {
    for (const [listId, cards] of cardsByList.entries()) {
      if (cards.some((c) => c.id === cardId)) {
        return listId;
      }
    }
    return null;
  }, [cardsByList]);

  // Get card by ID
  const getCard = useCallback((cardId: string): Card | null => {
    for (const cards of cardsByList.values()) {
      const card = cards.find((c) => c.id === cardId);
      if (card) return card;
    }
    return null;
  }, [cardsByList]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeIdStr = active.id.toString();

    // Check if it's a list or a card
    if (lists.some((l) => l.id === activeIdStr)) {
      setActiveType('list');
      setDragSourceListId(null);
    } else {
      setActiveType('card');
      // Track which list the card is being dragged from
      setDragSourceListId(findListContainingCard(activeIdStr));
    }
    setActiveId(activeIdStr);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id.toString();
    const overIdStr = over.id.toString();

    if (activeIdStr === overIdStr) return;

    // Only handle card movements
    if (activeType !== 'card') return;

    const activeListId = findListContainingCard(activeIdStr);
    let overListId = findListContainingCard(overIdStr);

    // If over is a list (not a card), use it as the target list
    if (!overListId && lists.some((l) => l.id === overIdStr)) {
      overListId = overIdStr;
    }

    if (!activeListId || !overListId) return;

    // Moving within the same list is handled by DragEnd
    if (activeListId === overListId) return;

    // Moving to a different list
    setCardsByList((prev) => {
      const newMap = new Map(prev);
      const sourceCards = [...(newMap.get(activeListId) || [])];
      const destCards = [...(newMap.get(overListId) || [])];

      const activeIndex = sourceCards.findIndex((c) => c.id === activeIdStr);
      if (activeIndex === -1) return prev;

      const [movedCard] = sourceCards.splice(activeIndex, 1);

      // Find position after pinned cards in destination list
      const pinnedCount = destCards.filter(c => c.pinned).length;

      // Insert after pinned cards (at the top of non-pinned cards)
      destCards.splice(pinnedCount, 0, { ...movedCard, listId: overListId });

      newMap.set(activeListId, sourceCards);
      newMap.set(overListId, destCards);

      return newMap;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    // Capture source list before clearing state
    const sourceListId = dragSourceListId;

    setActiveId(null);
    setActiveType(null);
    setDragSourceListId(null);

    if (!over) return;

    const activeIdStr = active.id.toString();
    const overIdStr = over.id.toString();

    if (activeIdStr === overIdStr) return;

    // Handle list reordering
    if (activeType === 'list') {
      const oldIndex = lists.findIndex((l) => l.id === activeIdStr);
      const newIndex = lists.findIndex((l) => l.id === overIdStr);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newLists = arrayMove(lists, oldIndex, newIndex);
        setLists(newLists);

        // Update positions in backend
        try {
          await Promise.all(
            newLists.map((list, index) =>
              updateList(list.id, { position: index })
            )
          );
        } catch {
          setError('Failed to save list order');
        }
      }
      return;
    }

    // Get current list containing the card
    const currentListId = findListContainingCard(activeIdStr);
    if (!currentListId) return;

    // Check if card moved to a different list
    const movedToNewList = sourceListId && sourceListId !== currentListId;

    if (movedToNewList) {
      // Card was moved to a different list - ensure it's at the top (after pinned cards)
      const destCards = cardsByList.get(currentListId) || [];

      // Find the position after any pinned cards (excluding the moved card itself)
      const pinnedCount = destCards.filter(c => c.id !== activeIdStr && c.pinned).length;

      // Compute the new card order BEFORE updating state so we can use it for backend
      const currentCards = [...destCards];
      const cardIndex = currentCards.findIndex(c => c.id === activeIdStr);
      let newCardOrder: Card[] = [];

      if (cardIndex !== -1) {
        const [movedCard] = currentCards.splice(cardIndex, 1);
        // Insert after pinned cards (at position pinnedCount)
        currentCards.splice(pinnedCount, 0, movedCard);
        newCardOrder = currentCards;
      } else {
        newCardOrder = currentCards;
      }

      // Update UI state with the computed order
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        newMap.set(currentListId, newCardOrder);
        return newMap;
      });

      // Update backend using the computed order (not stale state)
      try {
        // Update the moved card with new list and position (after pinned cards)
        await updateCard(activeIdStr, {
          listId: currentListId,
          position: pinnedCount,
        });

        // Update positions for all other cards in the destination list
        await Promise.all(
          newCardOrder.map((c, index) => {
            if (c.id !== activeIdStr) {
              return updateCard(c.id, { position: index });
            }
            return Promise.resolve();
          })
        );
      } catch {
        setError('Failed to move card');
      }
    } else {
      // Card reordering within the same list
      const cards = cardsByList.get(currentListId) || [];
      const oldIndex = cards.findIndex((c) => c.id === activeIdStr);
      const newIndex = cards.findIndex((c) => c.id === overIdStr);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newCards = arrayMove(cards, oldIndex, newIndex);
        const newCardsMap = new Map(cardsByList);
        newCardsMap.set(currentListId, newCards);
        setCardsByList(newCardsMap);

        // Update positions in backend
        try {
          await Promise.all(
            newCards.map((card, index) =>
              updateCard(card.id, { position: index })
            )
          );
        } catch {
          setError('Failed to save card order');
        }
      }
    }
  };

  // Get the active card or list for the drag overlay
  const getActiveItem = () => {
    if (!activeId) return null;

    if (activeType === 'list') {
      return lists.find((l) => l.id === activeId);
    }

    return getCard(activeId);
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: currentBoard?.background || '#0079BF' }}
      >
        <BoardSkeleton />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: currentBoard?.background || '#0079BF' }}
    >
      {/* Board Header */}
      <header className="bg-black/30 backdrop-blur-sm relative z-20">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to={`/workspace/${currentBoard?.workspaceId}`} className="text-white/80 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Link>

              {editingTitle ? (
                <input
                  type="text"
                  value={boardTitle}
                  onChange={(e) => setBoardTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                  autoFocus
                  className="bg-white/10 text-white text-xl font-bold px-2 py-1 rounded outline-none focus:bg-white/20"
                />
              ) : (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="text-xl font-bold text-white hover:bg-white/10 px-2 py-1 rounded"
                >
                  {currentBoard?.title || 'Board'}
                </button>
              )}

              <button
                onClick={handleToggleStar}
                className={`p-1.5 rounded ${
                  currentBoard?.starred ? 'text-yellow-400' : 'text-white/60 hover:text-white'
                }`}
              >
                <Star className={`h-5 w-5 ${currentBoard?.starred ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={() => setShowBoardMembers(true)}
                className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
                title="Board Members"
              >
                <Users className="h-5 w-5" />
              </button>

              <button
                onClick={() => setShowBoardSettings(true)}
                className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
                title="Board Settings"
              >
                <Settings className="h-5 w-5" />
              </button>

              <button
                onClick={() => setShowChat(true)}
                className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
                title="Board Chat"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {/* Search */}
              {showSearch ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cards..."
                    className="pl-9 pr-8 py-1.5 w-56 rounded bg-white/90 text-gray-800 text-sm placeholder-gray-500 outline-none focus:bg-white focus:ring-2 focus:ring-white/50"
                    onBlur={() => {
                      if (!searchQuery) setShowSearch(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        setShowSearch(false);
                      }
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowSearch(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                  }}
                  className="text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded flex items-center text-sm"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </button>
              )}
              {/* Advanced Filters - unified filter panel */}
              <AdvancedFilters
                filters={advancedFilters}
                onFiltersChange={setAdvancedFilters}
                availableMembers={workspaceMembers.map((m) => ({
                  id: m.id,
                  name: m.displayName,
                }))}
                customFieldDefs={customFieldDefs}
                currentUserId={currentUser?.id}
              />
              {/* My Cards Quick Filter */}
              {currentUser && (
                <button
                  onClick={() => {
                    if (memberFilter.length === 1 && memberFilter[0] === currentUser.id) {
                      setMemberFilter([]);
                    } else {
                      setMemberFilter([currentUser.id]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded flex items-center text-sm ${
                    memberFilter.length === 1 && memberFilter[0] === currentUser.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <User className="h-4 w-4 mr-2" />
                  My Cards
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowShareDropdown(!showShareDropdown)}
                  className={`px-3 py-1.5 rounded flex items-center text-sm ${
                    showShareDropdown ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Share
                </button>
                {showShareDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm">Share Board</h3>
                    </div>
                    <div className="p-3 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Board Link
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={window.location.href}
                            className="flex-1 text-sm px-2 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-700 dark:text-gray-200"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.href);
                              toast.success('Link copied to clipboard');
                              setShowShareDropdown(false);
                            }}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Copy link"
                          >
                            <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          window.open(window.location.href, '_blank');
                          setShowShareDropdown(false);
                        }}
                        className="w-full flex items-center px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                      >
                        <ExternalLink className="h-4 w-4 mr-2 text-gray-400" />
                        Open in new tab
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={toggleActivitySidebar}
                className={`px-3 py-1.5 rounded flex items-center text-sm ${
                  showActivitySidebar ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Activity
              </button>
              {activeUsers.length > 0 && (
                <div className="bg-white/10 rounded px-2 py-1">
                  <ActiveUsers users={activeUsers} maxDisplay={3} />
                </div>
              )}
              <ConnectionStatus
                state={mercureConnection}
                onReconnect={mercureConnection.reconnect}
                className="text-white/80 p-1.5"
              />
              <ViewSelector
                currentView={currentView}
                onViewChange={setCurrentView}
              />
              <ViewSettings
                currentView={currentView}
                settings={viewSettings}
                onSettingsChange={setViewSettings}
              />
              <SavedViews
                boardId={id || ''}
                currentView={currentView}
                currentSettings={viewSettings}
                currentFilters={advancedFilters}
                savedViews={savedViews}
                onSaveView={handleSaveView}
                onLoadView={handleLoadView}
                onDeleteView={handleDeleteView}
                onSetDefault={handleSetDefaultView}
              />
              <button
                onClick={() => setShowCustomFields(true)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded flex items-center gap-1"
                title="Custom Fields"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">Fields</span>
              </button>
              <button
                onClick={() => setShowAutomationRules(true)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded flex items-center gap-1"
                title="Automation Rules"
              >
                <Zap className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">Automation</span>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowFieldVisibilityMenu(!showFieldVisibilityMenu)}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded flex items-center gap-1"
                  title="Card Field Visibility"
                >
                  <EyeOff className="h-4 w-4" />
                  <span className="text-sm hidden sm:inline">Show/Hide</span>
                </button>
                {showFieldVisibilityMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowFieldVisibilityMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 w-56">
                      <h5 className="text-sm font-medium text-gray-700 mb-2 pb-2 border-b">Card Fields Visibility</h5>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldVisibility.labels}
                          onChange={(e) => setFieldVisibility((prev) => ({ ...prev, labels: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Labels</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldVisibility.startDate}
                          onChange={(e) => setFieldVisibility((prev) => ({ ...prev, startDate: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Start Date</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldVisibility.dueDate}
                          onChange={(e) => setFieldVisibility((prev) => ({ ...prev, dueDate: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Due Date</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldVisibility.members}
                          onChange={(e) => setFieldVisibility((prev) => ({ ...prev, members: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Members</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldVisibility.customFields}
                          onChange={(e) => setFieldVisibility((prev) => ({ ...prev, customFields: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Custom Fields</span>
                      </label>
                    </div>
                    <div className="border-t border-gray-200 mt-3 pt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldVisibility.expanded}
                          onChange={(e) => setFieldVisibility((prev) => ({ ...prev, expanded: e.target.checked }))}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700">Expanded View</span>
                          <span className="text-xs text-gray-500">Show description, badges, full labels</span>
                        </div>
                      </label>
                    </div>
                      <button
                        onClick={() => setShowFieldVisibilityMenu(false)}
                        className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500 text-white px-4 py-2 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Search Results Banner */}
      {searchQuery && (
        <div className="bg-yellow-100 text-yellow-800 px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Search className="h-4 w-4 mr-2" />
            <span>
              Showing cards matching "<strong>{searchQuery}</strong>"
              {' — '}
              {Array.from(filteredCardsByList.values()).reduce((sum, cards) => sum + cards.length, 0)} cards found
            </span>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
            className="text-yellow-800 hover:text-yellow-900 underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Active Filters Banner - shows all active filters */}
      {(labelFilter.length > 0 || memberFilter.length > 0 || advancedFilters.dueDateFilter || advancedFilters.completionStatus || customFieldFilter.length > 0) && (
        <div className="bg-blue-100 text-blue-800 px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center flex-wrap gap-2">
            <Filter className="h-4 w-4" />
            <span>Active filters:</span>

            {/* Labels */}
            {labelFilter.map((label) => (
              <span
                key={`label-${label}`}
                className={`px-2 py-0.5 rounded text-white text-xs capitalize ${
                  label === 'green' ? 'bg-green-500' :
                  label === 'yellow' ? 'bg-yellow-500 text-yellow-900' :
                  label === 'orange' ? 'bg-orange-500' :
                  label === 'red' ? 'bg-red-500' :
                  label === 'purple' ? 'bg-purple-500' :
                  'bg-blue-500'
                }`}
              >
                {label}
              </span>
            ))}

            {/* Members */}
            {memberFilter.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-200 rounded text-xs">
                {memberFilter.length} member{memberFilter.length > 1 ? 's' : ''}
              </span>
            )}

            {/* Due Date */}
            {advancedFilters.dueDateFilter && (
              <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded text-xs">
                {advancedFilters.dueDateFilter === 'overdue' && 'Overdue'}
                {advancedFilters.dueDateFilter === 'today' && 'Due today'}
                {advancedFilters.dueDateFilter === 'this_week' && 'Due this week'}
                {advancedFilters.dueDateFilter === 'this_month' && 'Due this month'}
                {advancedFilters.dueDateFilter === 'no_date' && 'No due date'}
              </span>
            )}

            {/* Completion Status */}
            {advancedFilters.completionStatus && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                advancedFilters.completionStatus === 'completed'
                  ? 'bg-green-200 text-green-800'
                  : 'bg-gray-200 text-gray-800'
              }`}>
                {advancedFilters.completionStatus === 'completed' ? 'Completed' : 'Not completed'}
              </span>
            )}

            {/* Custom Fields */}
            {customFieldFilter.map((filter) => {
              const fieldDef = customFieldDefs.find((d) => d.id === filter.definitionId);
              if (!fieldDef) return null;
              let displayValue = filter.value;
              if (fieldDef.type === 'checkbox') {
                displayValue = filter.value === 'true' ? 'Yes' : 'No';
              }
              return (
                <span
                  key={`cf-${filter.definitionId}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-xs"
                >
                  <strong>{fieldDef.title}:</strong> {displayValue}
                </span>
              );
            })}

            <span className="text-blue-600">
              — {Array.from(filteredCardsByList.values()).reduce((sum, cards) => sum + cards.length, 0)} cards
            </span>
          </div>
          <button
            onClick={() => setAdvancedFilters(DEFAULT_FILTER_STATE)}
            className="text-blue-800 hover:text-blue-900 underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Board Content */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden">
          {currentView === 'kanban' ? (
            <div className="h-full overflow-x-auto overflow-y-hidden p-4">
              <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex items-start space-x-3 h-full">
            <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
              {lists.map((list) => (
                <SortableList
                  key={list.id}
                  list={list}
                  cards={filteredCardsByList.get(list.id) || []}
                  onDeleteList={handleDeleteList}
                  onArchiveList={handleArchiveList}
                  onUpdateList={handleUpdateList}
                  onCardClick={handleCardClick}
                  onQuickComplete={handleQuickComplete}
                  onQuickArchive={handleQuickArchive}
                  addingCardToList={addingCardToList}
                  setAddingCardToList={setAddingCardToList}
                  newCardTitle={newCardTitle}
                  setNewCardTitle={setNewCardTitle}
                  onAddCard={handleAddCard}
                  onOpenTemplatePicker={handleOpenTemplatePicker}
                  collapsedLists={collapsedLists}
                  toggleCollapse={toggleListCollapse}
                  customFieldDefs={customFieldDefs}
                  customFieldValues={customFieldValues}
                  searchQuery={searchQuery}
                  fieldVisibility={fieldVisibility}
                  canCreateCard={canCreate('card')}
                  canEditList={canEdit('list', false)}
                  canDeleteList={canDelete('list', false)}
                />
              ))}
            </SortableContext>

            {/* Add List */}
            <div className="w-72 flex-shrink-0">
              {addingListId === 'new' ? (
                <div className="bg-gray-100 rounded-xl p-3">
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddList()}
                    placeholder="Enter list title..."
                    autoFocus
                    className="w-full p-2 rounded border border-gray-300 text-sm outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center space-x-2 mt-2">
                    <button
                      onClick={handleAddList}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                    >
                      Add list
                    </button>
                    <button
                      onClick={() => {
                        setAddingListId(null);
                        setNewListTitle('');
                      }}
                      className="p-1.5 text-gray-500 hover:text-gray-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : canCreate('list') ? (
                <button
                  onClick={() => setAddingListId('new')}
                  className="w-full bg-white/20 hover:bg-white/30 text-white rounded-xl px-4 py-3 text-left flex items-center font-medium transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add another list
                </button>
              ) : null}
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeId && activeType === 'card' && (
              <CardDragOverlay card={getActiveItem() as Card | null} />
            )}
            {activeId && activeType === 'list' && (
              <ListDragOverlay list={getActiveItem() as BoardList | null} cards={cardsByList.get(activeId) || []} />
            )}
              </DragOverlay>
              </DndContext>
            </div>
          ) : currentView === 'calendar' ? (
            <CalendarView cards={allFilteredCards} onCardClick={handleCardClick} settings={viewSettings.calendar} />
          ) : currentView === 'timeline' ? (
            <TimelineView cards={allFilteredCards} onCardClick={handleCardClick} settings={viewSettings.timeline} />
          ) : currentView === 'table' ? (
            <TableView cards={allFilteredCards} lists={lists} onCardClick={handleCardClick} settings={viewSettings.table} />
          ) : currentView === 'dashboard' ? (
            <DashboardView cards={allFilteredCards} lists={lists} onCardClick={handleCardClick} settings={viewSettings.dashboard} />
          ) : null}
        </main>

      {/* Activity Sidebar */}
      {showActivitySidebar && (
        <div className="w-80 bg-white shadow-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Board Activity</h3>
            <button
              onClick={() => setShowActivitySidebar(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingBoardActivities ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : boardActivities.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No activity yet</p>
            ) : (
              <div className="space-y-4">
                {boardActivities.map((activity) => {
                  const display = getActivityDisplay(activity.type);
                  return (
                    <div key={activity.id} className="flex items-start">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium mr-3 flex-shrink-0">
                        {activity.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">{activity.authorName}</span>{' '}
                          <span>{display.label}</span>
                        </p>
                        {activity.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{activity.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{formatBoardActivityTime(activity.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 border-t">
            <button
              onClick={loadBoardActivities}
              className="w-full text-sm text-blue-600 hover:text-blue-700 py-2"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Keyboard Shortcuts Help */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Search cards</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">/</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Create new card</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">N</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Create new list</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">L</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Toggle activity sidebar</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">A</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Close / Cancel</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Esc</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Show this help</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">?</kbd>
              </div>
            </div>
            <p className="mt-6 text-sm text-gray-500 text-center">
              Press any key to close
            </p>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          listTitle={lists.find((l) => l.id === selectedCard.listId)?.title || 'List'}
          boardId={currentBoard?.id}
          workspaceMembers={workspaceMembers}
          onClose={() => setSelectedCard(null)}
          onUpdate={handleCardUpdate}
          onDelete={() => handleDeleteCard(selectedCard)}
          onArchive={() => handleArchiveCard(selectedCard)}
          onCopy={() => handleCopyCard(selectedCard)}
          customFieldDefs={customFieldDefs}
          initialCustomFieldValues={customFieldValues.get(selectedCard.id) || []}
          onCustomFieldChange={(cardId, values) => {
            setCustomFieldValues((prev) => {
              const newMap = new Map(prev);
              newMap.set(cardId, values);
              return newMap;
            });
          }}
          departments={departments}
          clients={clients}
          onDepartmentChange={async (cardId, departmentId) => {
            const updatedCard = await updateCardDepartment(cardId, departmentId);
            setCardsByList((prev) => {
              const newMap = new Map(prev);
              const listCards = newMap.get(updatedCard.listId) || [];
              const updatedCards = listCards.map((c) =>
                c.id === cardId ? { ...c, department: updatedCard.department } : c
              );
              newMap.set(updatedCard.listId, updatedCards);
              return newMap;
            });
            // Update selectedCard too so the modal reflects the change
            setSelectedCard((prev) => prev ? { ...prev, department: updatedCard.department } : null);
          }}
          onClientChange={async (cardId, clientId) => {
            const updatedCard = await updateCardClient(cardId, clientId);
            setCardsByList((prev) => {
              const newMap = new Map(prev);
              const listCards = newMap.get(updatedCard.listId) || [];
              const updatedCards = listCards.map((c) =>
                c.id === cardId ? { ...c, client: updatedCard.client } : c
              );
              newMap.set(updatedCard.listId, updatedCards);
              return newMap;
            });
            // Update selectedCard too so the modal reflects the change
            setSelectedCard((prev) => prev ? { ...prev, client: updatedCard.client } : null);
          }}
          canEditCard={canEdit('card', selectedCard.authorId === currentUser?.id)}
          canDeleteCard={canDelete('card', selectedCard.authorId === currentUser?.id)}
          canMoveCard={canMove('card', selectedCard.authorId === currentUser?.id)}
          onMove={async (cardId, fromListId, toListId) => {
            // Get the destination list cards BEFORE updating state
            const destCards = cardsByList.get(toListId) || [];
            const pinnedCount = destCards.filter(c => c.pinned).length;
            const existingNonPinnedCards = destCards.filter(c => !c.pinned);

            // Update UI immediately
            setCardsByList((prev) => {
              const newMap = new Map(prev);

              // Get the source list and remove the card
              const sourceCards = [...(newMap.get(fromListId) || [])];
              const cardIndex = sourceCards.findIndex(c => c.id === cardId);
              if (cardIndex === -1) return prev;

              const [movedCard] = sourceCards.splice(cardIndex, 1);
              newMap.set(fromListId, sourceCards);

              // Get the destination list and add the card at the top (after pinned cards)
              const destCardsCopy = [...(newMap.get(toListId) || [])];
              const destPinnedCount = destCardsCopy.filter(c => c.pinned).length;

              // Update the card's listId and insert at the correct position
              const updatedCard = { ...movedCard, listId: toListId, position: destPinnedCount };
              destCardsCopy.splice(destPinnedCount, 0, updatedCard);
              newMap.set(toListId, destCardsCopy);

              return newMap;
            });

            // Update backend positions of other cards in destination list (shift them down)
            try {
              await Promise.all(
                existingNonPinnedCards.map((card, index) =>
                  updateCard(card.id, { position: pinnedCount + 1 + index })
                )
              );
            } catch (err) {
              console.error('Failed to update card positions:', err);
            }
          }}
        />
      )}

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setShowTemplatePicker(false);
            setTemplatePickerListId(null);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Create from Template</h2>
              <button
                onClick={() => {
                  setShowTemplatePicker(false);
                  setTemplatePickerListId(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingTemplates ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <LayoutTemplate className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No templates available</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Save a card as a template to use it here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleCreateFromTemplate(template)}
                      disabled={isCreatingFromTemplate}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">
                            {template.title}
                          </h3>
                          {template.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            {template.labels.length > 0 && (
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{
                                    backgroundColor:
                                      template.labels[0] === 'green' ? '#22c55e' :
                                      template.labels[0] === 'yellow' ? '#eab308' :
                                      template.labels[0] === 'orange' ? '#f97316' :
                                      template.labels[0] === 'red' ? '#ef4444' :
                                      template.labels[0] === 'purple' ? '#a855f7' :
                                      '#3b82f6'
                                  }}
                                />
                                {template.labels.length} label{template.labels.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {template.checklists.length > 0 && (
                              <span>
                                {template.checklists.length} checklist{template.checklists.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {isCreatingFromTemplate && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500 ml-2 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Fields Manager */}
      {id && (
        <CustomFieldsManager
          boardId={id}
          isOpen={showCustomFields}
          onClose={() => setShowCustomFields(false)}
        />
      )}

      {/* Automation Rules Panel */}
      {showAutomationRules && id && currentBoard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAutomationRules(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <AutomationRules
            boardUuid={currentBoard.id}
            lists={lists.map(l => ({ id: l.id, name: l.title }))}
            labels={(['green', 'yellow', 'orange', 'red', 'purple', 'blue'] as CardLabel[]).map(color => ({
              id: color,
              name: color.charAt(0).toUpperCase() + color.slice(1),
              color: LABEL_COLORS[color],
            }))}
            members={workspaceMembers.map(m => ({ id: m.id, name: m.displayName }))}
            onClose={() => setShowAutomationRules(false)}
          />
          </div>
        </div>
      )}

      {/* Board Settings Modal */}
      {showBoardSettings && currentBoard && (
        <BoardSettingsModal
          board={currentBoard}
          onClose={() => setShowBoardSettings(false)}
          onUpdate={(updated) => {
            setCurrentBoard(updated);
            updateBoardInStore(updated);
          }}
          onDelete={() => {
            navigate(currentBoard.workspaceId
              ? `/workspace/${currentBoard.workspaceId}`
              : '/dashboard');
          }}
        />
      )}

      {/* Board Members Modal */}
      {showBoardMembers && currentBoard && (
        <BoardMembersModal
          boardId={currentBoard.id}
          workspaceId={currentBoard.workspaceId}
          onClose={() => setShowBoardMembers(false)}
        />
      )}

      {/* Chat Panel */}
      {currentBoard && (
        <ChatPanel
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          channelType="board"
          entityId={currentBoard.id}
          entityName={currentBoard.title}
        />
      )}
    </div>
  );
}

// List color options
const LIST_COLORS = [
  { name: 'None', value: null },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

// Sortable List Component
function SortableList({
  list,
  cards,
  onDeleteList,
  onArchiveList,
  onUpdateList,
  onCardClick,
  onQuickComplete,
  onQuickArchive,
  addingCardToList,
  setAddingCardToList,
  newCardTitle,
  setNewCardTitle,
  onAddCard,
  onOpenTemplatePicker,
  collapsedLists,
  toggleCollapse,
  customFieldDefs,
  customFieldValues,
  searchQuery = '',
  fieldVisibility,
  canCreateCard,
  canEditList,
  canDeleteList,
}: {
  list: BoardList;
  cards: Card[];
  onDeleteList: (id: string) => void;
  onArchiveList: (id: string) => void;
  onUpdateList: (id: string, data: { title?: string; wipLimit?: number; color?: string | null }) => void;
  onCardClick: (card: Card) => void;
  onQuickComplete: (card: Card) => void;
  onQuickArchive: (card: Card) => void;
  addingCardToList: string | null;
  setAddingCardToList: (id: string | null) => void;
  newCardTitle: string;
  setNewCardTitle: (title: string) => void;
  onAddCard: (listId: string) => void;
  onOpenTemplatePicker: (listId: string) => void;
  collapsedLists: Set<string>;
  toggleCollapse: (listId: string) => void;
  customFieldDefs: CustomFieldDefinition[];
  customFieldValues: Map<string, CustomFieldValue[]>;
  searchQuery?: string;
  fieldVisibility: CardFieldVisibilityProps;
  // Permission checks
  canCreateCard: boolean;
  canEditList: boolean;
  canDeleteList: boolean;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWipSettings, setShowWipSettings] = useState(false);
  const [wipLimitValue, setWipLimitValue] = useState(list.wipLimit?.toString() || '0');

  // Virtual scrolling setup
  const virtualContainerRef = useRef<HTMLDivElement>(null);
  const VIRTUAL_THRESHOLD = 20; // Enable virtualization for lists with more than 20 cards
  const useVirtual = cards.length > VIRTUAL_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => virtualContainerRef.current,
    estimateSize: () => 80, // Estimated card height
    overscan: 5,
    enabled: useVirtual,
  });

  const isCollapsed = collapsedLists.has(list.id);
  const isOverWipLimit = list.wipLimit > 0 && cards.length > list.wipLimit;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== list.title) {
      onUpdateList(list.id, { title: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleColorSelect = (color: string | null) => {
    onUpdateList(list.id, { color });
    setShowColorPicker(false);
    setShowMenu(false);
  };

  const handleWipLimitSave = () => {
    const limit = parseInt(wipLimitValue) || 0;
    onUpdateList(list.id, { wipLimit: limit });
    setShowWipSettings(false);
    setShowMenu(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-100 rounded-xl w-72 flex-shrink-0 flex flex-col ${isCollapsed ? '' : 'max-h-full'}`}
    >
      {/* Color Bar */}
      {list.color && (
        <div
          className="h-2 rounded-t-xl"
          style={{ backgroundColor: list.color }}
        />
      )}

      {/* List Header */}
      <div
        className={`p-3 flex items-center justify-between ${list.color ? '' : 'rounded-t-xl'}`}
      >
        <div
          {...attributes}
          {...listeners}
          className="flex items-center flex-1 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-gray-400 mr-1 flex-shrink-0" />
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') {
                  setEditedTitle(list.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="font-semibold text-gray-800 bg-white px-2 py-1 rounded border border-blue-500 outline-none flex-1"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3
              className="font-semibold text-gray-800 cursor-text flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              {list.title}
            </h3>
          )}
          {/* WIP Limit Badge */}
          {list.wipLimit > 0 && (
            <span
              className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                isOverWipLimit
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {cards.length}/{list.wipLimit}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {/* Collapse Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(list.id);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>

          {/* Menu Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <div className="py-1">
                  {canCreateCard && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setAddingCardToList(list.id);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add card
                    </button>
                  )}
                  {canEditList && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(!showColorPicker);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Set color
                    </button>
                  )}
                  {showColorPicker && (
                    <div className="px-4 py-2 flex flex-wrap gap-2">
                      {LIST_COLORS.map((color) => (
                        <button
                          key={color.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleColorSelect(color.value);
                          }}
                          className={`w-6 h-6 rounded-full border-2 ${
                            list.color === color.value ? 'border-blue-500' : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.value || '#e5e7eb' }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  )}
                  {canEditList && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowWipSettings(!showWipSettings);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Set WIP limit
                      </button>
                      {showWipSettings && (
                        <div className="px-4 py-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              value={wipLimitValue}
                              onChange={(e) => setWipLimitValue(e.target.value)}
                              className="w-16 px-2 py-1 border rounded text-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWipLimitSave();
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                            >
                              Set
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">0 = no limit</p>
                        </div>
                      )}
                    </>
                  )}
                  {canDeleteList && (
                    <>
                      <hr className="my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          onArchiveList(list.id);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive list
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          if (confirm('Delete this list and all its cards?')) {
                            onDeleteList(list.id);
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete list
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WIP Limit Warning */}
      {isOverWipLimit && !isCollapsed && (
        <div className="mx-2 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>Over WIP limit ({cards.length}/{list.wipLimit})</span>
        </div>
      )}

      {/* Cards (collapsible) - with optional virtual scrolling for large lists */}
      {!isCollapsed && (
        <div
          ref={virtualContainerRef}
          className="flex-1 overflow-y-auto px-2 pb-2"
          style={useVirtual ? { contain: 'strict' } : undefined}
        >
          {/* Add Card Form - at the top of the list */}
          {addingCardToList === list.id ? (
            <div className="bg-white rounded-lg p-2 shadow-sm mb-2">
              <textarea
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onAddCard(list.id);
                  }
                }}
                placeholder="Enter a title for this card..."
                autoFocus
                className="w-full p-2 text-sm border-none outline-none resize-none"
                rows={3}
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onAddCard(list.id)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                >
                  Add card
                </button>
                <button
                  onClick={() => {
                    setAddingCardToList(null);
                    setNewCardTitle('');
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : canCreateCard ? (
            <div className="flex items-center gap-1 mb-2">
              <button
                onClick={() => setAddingCardToList(list.id)}
                className="flex-1 text-left px-3 py-2 text-gray-500 hover:bg-gray-200 rounded-lg flex items-center text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add a card
              </button>
              <button
                onClick={() => onOpenTemplatePicker(list.id)}
                className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg"
                title="Create from template"
              >
                <LayoutTemplate className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {useVirtual ? (
              // Virtualized rendering for large lists
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const card = cards[virtualItem.index];
                  if (!card) return null;
                  return (
                    <div
                      key={card.id}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                        paddingBottom: '8px',
                      }}
                    >
                      <SortableCard
                        card={card}
                        onClick={() => onCardClick(card)}
                        onQuickComplete={(e) => {
                          e.stopPropagation();
                          onQuickComplete(card);
                        }}
                        onQuickArchive={(e) => {
                          e.stopPropagation();
                          onQuickArchive(card);
                        }}
                        onQuickEdit={(e) => {
                          e.stopPropagation();
                          onCardClick(card);
                        }}
                        customFieldDefs={customFieldDefs}
                        cardCustomFieldValues={customFieldValues.get(card.id) || []}
                        searchQuery={searchQuery}
                        fieldVisibility={fieldVisibility}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              // Normal rendering for small lists
              <div className="space-y-2">
                {cards.map((card) => (
                  <SortableCard
                    key={card.id}
                    card={card}
                    onClick={() => onCardClick(card)}
                    onQuickComplete={(e) => {
                      e.stopPropagation();
                      onQuickComplete(card);
                    }}
                    onQuickArchive={(e) => {
                      e.stopPropagation();
                      onQuickArchive(card);
                    }}
                    onQuickEdit={(e) => {
                      e.stopPropagation();
                      onCardClick(card);
                    }}
                    customFieldDefs={customFieldDefs}
                    cardCustomFieldValues={customFieldValues.get(card.id) || []}
                    searchQuery={searchQuery}
                    fieldVisibility={fieldVisibility}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </div>
      )}

      {/* Collapsed Summary */}
      {isCollapsed && (
        <div className="px-3 pb-3 text-sm text-gray-500">
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// Sortable Card Component
interface CardFieldVisibilityProps {
  labels: boolean;
  startDate: boolean;
  dueDate: boolean;
  members: boolean;
  customFields: boolean;
  expanded: boolean;
}

function SortableCard({
  card,
  onClick,
  onQuickComplete,
  onQuickArchive,
  onQuickEdit,
  customFieldDefs,
  cardCustomFieldValues,
  searchQuery = '',
  fieldVisibility,
}: {
  card: Card;
  onClick: () => void;
  onQuickComplete: (e: React.MouseEvent) => void;
  onQuickArchive: (e: React.MouseEvent) => void;
  onQuickEdit: (e: React.MouseEvent) => void;
  customFieldDefs: CustomFieldDefinition[];
  cardCustomFieldValues: CustomFieldValue[];
  searchQuery?: string;
  fieldVisibility: CardFieldVisibilityProps;
}) {
  const [showQuickActions, setShowQuickActions] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow ${
        card.completed ? 'opacity-60' : ''
      } ${card.pinned ? 'ring-2 ring-amber-400' : ''}`}
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
    >
      {/* Pin Indicator */}
      {card.pinned && (
        <div className="absolute -top-1 -left-1 z-10">
          <div className="bg-amber-400 text-white p-1 rounded-full shadow-md" title="Pinned to top">
            <Pin className="h-3 w-3 fill-current" />
          </div>
        </div>
      )}

      {/* Quick Actions - appear on hover */}
      {showQuickActions && !isDragging && (
        <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10">
          <button
            onClick={onQuickComplete}
            className={`p-1 rounded transition-colors ${
              card.completed
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-white/90 text-gray-600 hover:bg-green-50 hover:text-green-600 shadow-sm'
            }`}
            title={card.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onQuickEdit}
            className="p-1 bg-white/90 text-gray-600 rounded shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Edit card"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onQuickArchive}
            className="p-1 bg-white/90 text-gray-600 rounded shadow-sm hover:bg-orange-50 hover:text-orange-600 transition-colors"
            title="Archive card"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Cover Image */}
      {card.coverImageUrl && (
        <div
          className="w-full h-32 bg-cover bg-center rounded-t-lg"
          style={{ backgroundImage: `url(${card.coverImageUrl})` }}
          {...attributes}
          {...listeners}
          onClick={onClick}
        />
      )}

      {/* Card Content - draggable area */}
      <div
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`p-3 cursor-grab active:cursor-grabbing ${card.coverImageUrl ? 'pt-2' : ''}`}
      >
        {fieldVisibility.labels && card.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {card.labels.map((label) => (
              fieldVisibility.expanded ? (
                <div
                  key={label}
                  className="px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: LABEL_COLORS[label] }}
                >
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </div>
              ) : (
                <div
                  key={label}
                  className="w-10 h-2 rounded"
                  style={{ backgroundColor: LABEL_COLORS[label] }}
                />
              )
            ))}
          </div>
        )}
        <div className="flex items-start gap-2">
          {card.completed && (
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
          <p className={`text-sm ${card.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {searchQuery ? highlightText(card.title, searchQuery) : card.title}
          </p>
        </div>
        {/* Description preview - expanded view only */}
        {fieldVisibility.expanded && card.description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
            {card.description.length > 120 ? card.description.substring(0, 120) + '...' : card.description}
          </p>
        )}
        {/* Activity badges - expanded view only */}
        {fieldVisibility.expanded && (card.commentCount > 0 || card.attachmentCount > 0 || card.checklistTotal > 0) && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {card.commentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                <MessageCircle className="h-3 w-3" />
                {card.commentCount}
              </span>
            )}
            {card.attachmentCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                <Paperclip className="h-3 w-3" />
                {card.attachmentCount}
              </span>
            )}
            {card.checklistTotal > 0 && (
              <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                card.checklistCompleted === card.checklistTotal
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                <CheckSquare className="h-3 w-3" />
                {card.checklistCompleted}/{card.checklistTotal}
              </span>
            )}
          </div>
        )}
        {((fieldVisibility.startDate && card.startDate) || (fieldVisibility.dueDate && card.dueDate) || card.description) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            {fieldVisibility.startDate && card.startDate && (() => {
              const startDate = new Date(card.startDate);
              const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;
              const dateStr = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = hasTime ? startDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

              return (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20">
                  <Clock className="h-3 w-3" />
                  <span>{dateStr}</span>
                  {hasTime && <span className="opacity-75">{timeStr}</span>}
                </span>
              );
            })()}
            {fieldVisibility.dueDate && card.dueDate && (() => {
              const dueDate = new Date(card.dueDate);
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
              const diffDays = Math.floor((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              let colorClass = 'text-gray-500 dark:text-gray-400';
              let bgClass = '';

              if (card.completed) {
                colorClass = 'text-green-600 dark:text-green-400';
                bgClass = 'bg-green-50 dark:bg-green-900/20';
              } else if (diffDays < 0) {
                // Overdue
                colorClass = 'text-red-600 dark:text-red-400';
                bgClass = 'bg-red-50 dark:bg-red-900/20';
              } else if (diffDays === 0) {
                // Due today
                colorClass = 'text-amber-600 dark:text-amber-400';
                bgClass = 'bg-amber-50 dark:bg-amber-900/20';
              } else if (diffDays <= 2) {
                // Due soon (within 2 days)
                colorClass = 'text-yellow-600 dark:text-yellow-400';
                bgClass = 'bg-yellow-50 dark:bg-yellow-900/20';
              }

              const hasTime = dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0;
              const dateStr = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = hasTime ? dueDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';

              return (
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${colorClass} ${bgClass}`}>
                  <Calendar className="h-3 w-3" />
                  <span>{dateStr}</span>
                  {hasTime && <span className="opacity-75">{timeStr}</span>}
                </span>
              );
            })()}
          </div>
        )}
        {/* Member Avatars with Names */}
        {fieldVisibility.members && card.members && card.members.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {(fieldVisibility.expanded ? card.members : card.members.slice(0, 2)).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full pl-0.5 pr-2 py-0.5"
                title={member.name}
              >
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[80px]">
                  {fieldVisibility.expanded ? member.name : member.name.split(' ')[0]}
                </span>
              </div>
            ))}
            {!fieldVisibility.expanded && card.members.length > 2 && (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{card.members.length - 2} more
                </span>
              </div>
            )}
          </div>
        )}
        {/* Custom Fields */}
        {fieldVisibility.customFields && cardCustomFieldValues.length > 0 && customFieldDefs.length > 0 && (
          <div className="mt-2 space-y-1">
            {(fieldVisibility.expanded ? cardCustomFieldValues : cardCustomFieldValues.slice(0, 2)).map((cfv) => {
              const fieldDef = customFieldDefs.find((d) => d.id === cfv.definitionId);
              if (!fieldDef || !cfv.value) return null;

              // Format value based on type
              let displayValue: React.ReactNode = cfv.value;
              const truncateLength = fieldVisibility.expanded ? 60 : 30;
              if (fieldDef.type === 'date' && cfv.value) {
                displayValue = new Date(cfv.value).toLocaleDateString();
              } else if (fieldDef.type === 'checkbox') {
                displayValue = cfv.value === 'true' ? 'Yes' : 'No';
              } else if (fieldDef.type === 'currency' && cfv.value) {
                displayValue = `$${parseFloat(cfv.value).toFixed(2)}`;
              } else if (fieldDef.type === 'rating' && cfv.value) {
                const rating = parseInt(cfv.value);
                displayValue = (
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-3 h-3 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </span>
                );
              } else if (fieldDef.type === 'longtext' && cfv.value) {
                displayValue = cfv.value.length > truncateLength ? cfv.value.substring(0, truncateLength) + '...' : cfv.value;
              } else if (fieldDef.type === 'url' && cfv.value) {
                try {
                  const url = new URL(cfv.value);
                  displayValue = url.hostname;
                } catch {
                  displayValue = cfv.value;
                }
              }

              return (
                <div key={cfv.id} className="flex items-center text-xs text-gray-500">
                  <span className={`font-medium text-gray-600 truncate ${fieldVisibility.expanded ? 'max-w-[100px]' : 'max-w-[60px]'}`}>{fieldDef.title}:</span>
                  <span className="ml-1 truncate">{displayValue}</span>
                </div>
              );
            })}
            {!fieldVisibility.expanded && cardCustomFieldValues.length > 2 && (
              <div className="text-xs text-gray-400">
                +{cardCustomFieldValues.length - 2} more fields
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Drag overlay for cards
function CardDragOverlay({ card }: { card: Card | null }) {
  if (!card) return null;

  return (
    <div className="bg-white rounded-lg p-3 shadow-lg rotate-3 cursor-grabbing w-64">
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((label) => (
            <div
              key={label}
              className="w-10 h-2 rounded"
              style={{ backgroundColor: LABEL_COLORS[label] }}
            />
          ))}
        </div>
      )}
      <p className="text-sm text-gray-800">{card.title}</p>
    </div>
  );
}

// Drag overlay for lists
function ListDragOverlay({ list, cards }: { list: BoardList | null; cards: Card[] }) {
  if (!list) return null;

  return (
    <div className="bg-gray-100 rounded-xl w-72 p-3 shadow-lg rotate-2 cursor-grabbing max-h-96 overflow-hidden">
      <div className="flex items-center mb-3">
        <GripVertical className="h-4 w-4 text-gray-400 mr-1" />
        <h3 className="font-semibold text-gray-800">{list.title}</h3>
      </div>
      <div className="space-y-2">
        {cards.slice(0, 3).map((card) => (
          <div key={card.id} className="bg-white rounded-lg p-2 shadow-sm">
            <p className="text-sm text-gray-800 truncate">{card.title}</p>
          </div>
        ))}
        {cards.length > 3 && (
          <div className="text-sm text-gray-500 text-center">
            +{cards.length - 3} more cards
          </div>
        )}
      </div>
    </div>
  );
}

// Card Detail Modal
function CardDetailModal({
  card,
  listTitle,
  boardId,
  workspaceMembers,
  onClose,
  onUpdate,
  onDelete,
  onArchive,
  onCopy,
  customFieldDefs,
  initialCustomFieldValues,
  onCustomFieldChange,
  departments,
  clients,
  onDepartmentChange,
  onClientChange,
  canEditCard,
  canDeleteCard,
  canMoveCard,
  onMove,
}: {
  card: Card;
  listTitle: string;
  boardId?: string;
  workspaceMembers: WorkspaceMember[];
  onClose: () => void;
  onUpdate: (cardId: string, updates: Partial<Card>) => void;
  onDelete: () => void;
  onArchive: () => void;
  onCopy: () => void;
  customFieldDefs: CustomFieldDefinition[];
  initialCustomFieldValues: CustomFieldValue[];
  onCustomFieldChange: (cardId: string, values: CustomFieldValue[]) => void;
  departments: TaxonomyTerm[];
  clients: TaxonomyTerm[];
  onDepartmentChange: (cardId: string, departmentId: string | null) => Promise<void>;
  onClientChange: (cardId: string, clientId: string | null) => Promise<void>;
  // Permission checks
  canEditCard: boolean;
  canDeleteCard: boolean;
  canMoveCard: boolean;
  onMove: (cardId: string, fromListId: string, toListId: string) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [editingDescription, setEditingDescription] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState(card.dueDate || '');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [startDate, setStartDate] = useState(card.startDate || '');
  const [comments, setComments] = useState<CardComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<CardAttachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState(card.coverImageUrl || '');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(true);
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [addingItemToChecklist, setAddingItemToChecklist] = useState<string | null>(null);
  const [addingSubItemTo, setAddingSubItemTo] = useState<{ checklistId: string; parentId: string } | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [editingItemDueDate, setEditingItemDueDate] = useState<string | null>(null);
  const [editingItemAssignee, setEditingItemAssignee] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [availableBoards, setAvailableBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [availableLists, setAvailableLists] = useState<BoardList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Watch state
  const { user: currentUser } = useAuthStore();
  const [isWatching, setIsWatching] = useState(
    currentUser && card.watcherIds ? card.watcherIds.includes(currentUser.id) : false
  );
  const [isTogglingWatch, setIsTogglingWatch] = useState(false);

  // Template state
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showTemplateNameModal, setShowTemplateNameModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Member state
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [cardMembers, setCardMembers] = useState<CardMember[]>(card.members || []);
  const [isTogglingMember, setIsTogglingMember] = useState(false);

  // Watchers state
  const [showWatchersPicker, setShowWatchersPicker] = useState(false);
  const [isAddingWatcher, setIsAddingWatcher] = useState(false);

  // Department and Client picker state
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [isUpdatingDepartment, setIsUpdatingDepartment] = useState(false);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);

  // Custom field state
  const [customFieldValueMap, setCustomFieldValueMap] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    initialCustomFieldValues.forEach((v) => map.set(v.definitionId, v.value));
    return map;
  });
  const [isSavingCustomField, setIsSavingCustomField] = useState(false);
  const [editingCustomFieldId, setEditingCustomFieldId] = useState<string | null>(null);

  // Card-scoped fields state
  const [showCardFieldsPicker, setShowCardFieldsPicker] = useState(false);
  const [isAddingCardField, setIsAddingCardField] = useState(false);
  const [cardFieldValues, setCardFieldValues] = useState<CustomFieldValue[]>(initialCustomFieldValues);

  // Sync cardFieldValues when card changes (component reuse with different card)
  useEffect(() => {
    setCardFieldValues(initialCustomFieldValues);
  }, [card.id]);

  // Get displayable fields (workspace + board + enabled card-scoped)
  const displayableFieldDefs = useMemo(() => {
    return getDisplayableFieldsForCard(cardFieldValues, customFieldDefs);
  }, [cardFieldValues, customFieldDefs]);

  // Get available card-scoped fields that haven't been added yet
  const availableCardFields = useMemo(() => {
    return getAvailableCardScopedFields(cardFieldValues, customFieldDefs);
  }, [cardFieldValues, customFieldDefs]);

  // Handle adding a card-scoped field
  const handleAddCardField = async (fieldDefId: string) => {
    setIsAddingCardField(true);
    try {
      const newValue = await enableCardScopedField(card.id, fieldDefId);
      // Use functional update and compute the new values
      let updatedValues: CustomFieldValue[] = [];
      setCardFieldValues(prev => {
        updatedValues = [...prev, newValue];
        return updatedValues;
      });
      // Also update the value map
      setCustomFieldValueMap(prev => {
        const newMap = new Map(prev);
        newMap.set(fieldDefId, '');
        return newMap;
      });
      // Notify parent with the computed updated values
      // Use setTimeout to ensure state update has been processed
      setTimeout(() => {
        onCustomFieldChange(card.id, updatedValues);
      }, 0);
      toast.success('Field added to card');
    } catch (err) {
      console.error('Failed to add card field:', err);
      toast.error('Failed to add field');
    } finally {
      setIsAddingCardField(false);
    }
  };

  // Handle removing a card-scoped field
  const handleRemoveCardField = async (fieldDefId: string) => {
    setIsAddingCardField(true);
    try {
      await disableCardScopedField(card.id, fieldDefId);
      // Use functional update to ensure we have the latest values
      let updatedValues: CustomFieldValue[] = [];
      setCardFieldValues(prev => {
        updatedValues = prev.filter(v => v.definitionId !== fieldDefId);
        return updatedValues;
      });
      // Also update the value map
      setCustomFieldValueMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(fieldDefId);
        return newMap;
      });
      // Notify parent with the computed updated values
      // Use setTimeout to ensure state update has been processed
      setTimeout(() => {
        onCustomFieldChange(card.id, updatedValues);
      }, 0);
      toast.success('Field removed from card');
    } catch (err) {
      console.error('Failed to remove card field:', err);
      toast.error('Failed to remove field');
    } finally {
      setIsAddingCardField(false);
    }
  };

  useEffect(() => {
    loadComments();
    loadAttachments();
    loadChecklists();
    loadActivities();
  }, [card.id]);

  const loadComments = async () => {
    try {
      setIsLoadingComments(true);
      const cardComments = await fetchCommentsByCard(card.id);
      setComments(cardComments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  };

  // Get filtered members for mention suggestions
  const filteredMentionMembers = useMemo(() => {
    if (!mentionQuery) return workspaceMembers;
    const query = mentionQuery.toLowerCase();
    return workspaceMembers.filter(
      (m) =>
        m.displayName.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [workspaceMembers, mentionQuery]);

  // Handle comment input change with mention detection
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Detect @mention
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentionSuggestions(true);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  };

  // Handle mention selection
  const handleSelectMention = (member: WorkspaceMember) => {
    const cursorPos = commentInputRef.current?.selectionStart || newComment.length;
    const textBeforeCursor = newComment.slice(0, cursorPos);
    const textAfterCursor = newComment.slice(cursorPos);

    // Find the @ position
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const beforeAt = textBeforeCursor.slice(0, textBeforeCursor.length - atMatch[0].length);
      const newValue = `${beforeAt}@${member.displayName} ${textAfterCursor}`;
      setNewComment(newValue);
    }

    setShowMentionSuggestions(false);
    setMentionQuery('');
    commentInputRef.current?.focus();
  };

  // Handle keyboard navigation in mention suggestions
  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionSuggestions && filteredMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMentionMembers.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMentionMembers[mentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionSuggestions(false);
      }
    } else if (e.key === 'Enter' && !showMentionSuggestions) {
      handleAddComment();
    }
  };

  // Parse @mentions from comment text
  const parseMentions = (text: string): WorkspaceMember[] => {
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const mentions: WorkspaceMember[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1].toLowerCase();
      const member = workspaceMembers.find(
        (m) => m.displayName.toLowerCase() === mentionName
      );
      if (member && !mentions.some((m) => m.id === member.id)) {
        mentions.push(member);
      }
    }

    return mentions;
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const comment = await createComment({ text: newComment, cardId: card.id });
      setComments([comment, ...comments]);

      // Parse mentions and send notifications
      const mentionedMembers = parseMentions(newComment);
      for (const member of mentionedMembers) {
        // Don't notify yourself
        if (member.id !== currentUser?.id) {
          try {
            await createNotification({
              userId: member.id,
              type: 'mentioned',
              message: `${currentUser?.displayName || currentUser?.username} mentioned you in a comment on "${card.title}"`,
              cardId: card.id,
              actorId: currentUser?.id,
            });
          } catch (notifErr) {
            console.error('Failed to create mention notification:', notifErr);
          }
        }
      }

      setNewComment('');
      setShowMentionSuggestions(false);
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    try {
      const updated = await updateComment(commentId, editingCommentText);
      setComments(comments.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleToggleReaction = async (commentId: string, reactionType: ReactionType) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment || !currentUser) return;

    try {
      const newReactions = await toggleReaction(commentId, reactionType, currentUser.id, comment.reactions);
      setComments(comments.map((c) =>
        c.id === commentId ? { ...c, reactions: newReactions } : c
      ));
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const loadAttachments = async () => {
    try {
      setIsLoadingAttachments(true);
      const cardAttachments = await fetchAttachmentsByCard(card.id);
      setAttachments(cardAttachments);
    } catch (err) {
      console.error('Failed to load attachments:', err);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await createAttachment(card.id, file);
        setAttachments((prev) => [attachment, ...prev]);
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await createAttachment(card.id, file);
        setAttachments((prev) => [attachment, ...prev]);
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteAttachment(attachmentId);
      setAttachments(attachments.filter((a) => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <FileText className="h-5 w-5 text-gray-500" />;
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast.warning('Please select an image file');
      return;
    }

    setIsUploadingCover(true);
    try {
      const updatedCard = await uploadCardCover(card.id, file);
      setCoverImageUrl(updatedCard.coverImageUrl || '');
      onUpdate(card.id, { coverImageUrl: updatedCard.coverImageUrl });
    } catch (err) {
      console.error('Failed to upload cover:', err);
    } finally {
      setIsUploadingCover(false);
      event.target.value = '';
    }
  };

  const handleRemoveCover = async () => {
    try {
      await removeCardCover(card.id);
      setCoverImageUrl('');
      onUpdate(card.id, { coverImageUrl: undefined });
    } catch (err) {
      console.error('Failed to remove cover:', err);
    }
  };

  const handleOpenMoveModal = async () => {
    setShowMoveModal(true);
    setIsLoadingBoards(true);
    try {
      const boards = await fetchAllBoards();
      setAvailableBoards(boards);
    } catch (err) {
      console.error('Failed to load boards:', err);
    } finally {
      setIsLoadingBoards(false);
    }
  };

  const handleBoardSelect = async (boardId: string) => {
    setSelectedBoardId(boardId);
    setSelectedListId('');
    setAvailableLists([]);

    if (!boardId) return;

    setIsLoadingLists(true);
    try {
      const lists = await fetchListsByBoard(boardId);
      setAvailableLists(lists);
    } catch (err) {
      console.error('Failed to load lists:', err);
    } finally {
      setIsLoadingLists(false);
    }
  };

  const handleMoveCard = async () => {
    if (!selectedListId) return;

    const fromListId = card.listId;
    setIsMoving(true);
    try {
      await updateCard(card.id, { listId: selectedListId, position: 0 });
      // Update the board state to show the card in the new list immediately
      onMove(card.id, fromListId, selectedListId);
      setShowMoveModal(false);
      // Close the modal since the card is now on a different list
      onClose();
    } catch (err) {
      console.error('Failed to move card:', err);
    } finally {
      setIsMoving(false);
    }
  };

  const handleToggleWatch = async () => {
    if (!currentUser) return;

    setIsTogglingWatch(true);
    try {
      if (isWatching) {
        await unwatchCard(card.id, currentUser.id);
        setIsWatching(false);
      } else {
        await watchCard(card.id, currentUser.id);
        setIsWatching(true);
      }
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    } finally {
      setIsTogglingWatch(false);
    }
  };

  const handleAddWatcher = async (userId: string, userName: string) => {
    if (!currentUser) return;

    setIsAddingWatcher(true);
    try {
      await watchCard(card.id, userId);
      toast.success(`${userName} added as watcher`);
      setShowWatchersPicker(false);
    } catch (err) {
      console.error('Failed to add watcher:', err);
      toast.error('Failed to add watcher');
    } finally {
      setIsAddingWatcher(false);
    }
  };

  const handleRemoveWatcher = async (userId: string, userName: string) => {
    if (!currentUser) return;

    setIsAddingWatcher(true);
    try {
      await unwatchCard(card.id, userId);
      toast.success(`${userName} removed as watcher`);
    } catch (err) {
      console.error('Failed to remove watcher:', err);
      toast.error('Failed to remove watcher');
    } finally {
      setIsAddingWatcher(false);
    }
  };

  const handleToggleMember = async (userId: string, userName: string) => {
    if (!currentUser) return;

    setIsTogglingMember(true);
    try {
      const isAssigned = cardMembers.some((m) => m.id === userId);
      if (isAssigned) {
        const updatedCard = await unassignMember(card.id, userId);
        setCardMembers(updatedCard.members);
        toast.success(`${userName} removed from card`);
      } else {
        const updatedCard = await assignMember(card.id, userId);
        setCardMembers(updatedCard.members);
        toast.success(`${userName} assigned to card`);

        // Create notification for the assigned member (if not assigning self)
        if (userId !== currentUser.id) {
          try {
            await createNotification({
              userId,
              type: 'member_assigned',
              message: `${currentUser.displayName || currentUser.username} assigned you to "${card.title}"`,
              cardId: card.id,
              actorId: currentUser.id,
            });
          } catch (notifErr) {
            console.error('Failed to create notification:', notifErr);
            // Don't show error to user - notification is secondary
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle member:', err);
      toast.error('Failed to update member assignment');
    } finally {
      setIsTogglingMember(false);
    }
  };

  const handleDepartmentChange = async (departmentId: string | null) => {
    setIsUpdatingDepartment(true);
    try {
      await onDepartmentChange(card.id, departmentId);
      const dept = departments.find((d) => d.id === departmentId);
      toast.success(departmentId ? `Department set to ${dept?.name}` : 'Department removed');
      setShowDepartmentPicker(false);
    } catch (err) {
      console.error('Failed to update department:', err);
      toast.error('Failed to update department');
    } finally {
      setIsUpdatingDepartment(false);
    }
  };

  const handleClientChange = async (clientId: string | null) => {
    setIsUpdatingClient(true);
    try {
      await onClientChange(card.id, clientId);
      const clnt = clients.find((c) => c.id === clientId);
      toast.success(clientId ? `Client set to ${clnt?.name}` : 'Client removed');
      setShowClientPicker(false);
    } catch (err) {
      console.error('Failed to update client:', err);
      toast.error('Failed to update client');
    } finally {
      setIsUpdatingClient(false);
    }
  };

  const handleCustomFieldChange = async (definitionId: string, value: string) => {
    setIsSavingCustomField(true);
    try {
      const savedValue = await setCardCustomFieldValue(card.id, definitionId, value);
      setCustomFieldValueMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(definitionId, value);
        return newMap;
      });

      // Update parent state with new value
      const updatedValues = [...initialCustomFieldValues.filter((v) => v.definitionId !== definitionId)];
      if (value) {
        updatedValues.push(savedValue);
      }
      onCustomFieldChange(card.id, updatedValues);

      toast.success('Custom field updated');
    } catch (err) {
      console.error('Failed to update custom field:', err);
      toast.error('Failed to update custom field');
    } finally {
      setIsSavingCustomField(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;

    setIsSavingTemplate(true);
    try {
      // Convert checklists to template format
      const checklistTemplates: ChecklistTemplate[] = checklists.map((cl) => ({
        title: cl.title,
        items: cl.items.map((item) => ({ title: item.title })),
      }));

      await createTemplate({
        title: templateName,
        description: card.description || undefined,
        labels: card.labels.length > 0 ? card.labels : undefined,
        checklists: checklistTemplates.length > 0 ? checklistTemplates : undefined,
      });

      setShowTemplateNameModal(false);
      setTemplateName('');
      toast.success('Template saved successfully!');
    } catch (err) {
      console.error('Failed to save template:', err);
      toast.error('Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const loadChecklists = async () => {
    try {
      setIsLoadingChecklists(true);
      const cardChecklists = await fetchChecklistsByCard(card.id);
      setChecklists(cardChecklists);
    } catch (err) {
      console.error('Failed to load checklists:', err);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    try {
      const checklist = await createChecklist(card.id, newChecklistTitle);
      setChecklists([...checklists, checklist]);
      setNewChecklistTitle('');
      setShowAddChecklist(false);
    } catch (err) {
      console.error('Failed to create checklist:', err);
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!confirm('Delete this checklist?')) return;
    try {
      await deleteChecklist(checklistId);
      setChecklists(checklists.filter((c) => c.id !== checklistId));
    } catch (err) {
      console.error('Failed to delete checklist:', err);
    }
  };

  const handleAddChecklistItem = async (checklistId: string, parentId?: string) => {
    if (!newItemTitle.trim()) return;
    try {
      const checklist = checklists.find((c) => c.id === checklistId);
      let position = 0;

      if (parentId && checklist) {
        // Find parent and count its children
        const findParent = (items: ChecklistItem[]): ChecklistItem | undefined => {
          for (const item of items) {
            if (item.id === parentId) return item;
            if (item.children?.length) {
              const found = findParent(item.children);
              if (found) return found;
            }
          }
          return undefined;
        };
        const parent = findParent(checklist.items);
        position = parent?.children?.length || 0;
      } else if (checklist) {
        position = checklist.items.length;
      }

      // Auto-assign to card's assignee (single member)
      const cardAssigneeId = cardMembers.length > 0 ? cardMembers[0].id : undefined;
      const item = await createChecklistItem(checklistId, newItemTitle, position, parentId, cardAssigneeId);

      // Update checklist items with new nested item
      const addItemToList = (items: ChecklistItem[]): ChecklistItem[] => {
        if (parentId) {
          return items.map(i => {
            if (i.id === parentId) {
              return { ...i, children: [...(i.children || []), item] };
            }
            if (i.children?.length) {
              return { ...i, children: addItemToList(i.children) };
            }
            return i;
          });
        }
        return [...items, item];
      };

      setChecklists(checklists.map((c) =>
        c.id === checklistId ? { ...c, items: addItemToList(c.items) } : c
      ));
      setNewItemTitle('');
      setAddingItemToChecklist(null);
      setAddingSubItemTo(null);
    } catch (err) {
      console.error('Failed to create checklist item:', err);
    }
  };

  // Helper to recursively update an item in nested structure
  const updateItemInList = (items: ChecklistItem[], itemId: string, updater: (item: ChecklistItem) => ChecklistItem): ChecklistItem[] => {
    return items.map((item) => {
      if (item.id === itemId) {
        return updater(item);
      }
      if (item.children?.length) {
        return { ...item, children: updateItemInList(item.children, itemId, updater) };
      }
      return item;
    });
  };

  // Helper to recursively remove an item from nested structure
  const removeItemFromList = (items: ChecklistItem[], itemId: string): ChecklistItem[] => {
    return items
      .filter((item) => item.id !== itemId)
      .map((item) => {
        if (item.children?.length) {
          return { ...item, children: removeItemFromList(item.children, itemId) };
        }
        return item;
      });
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string, completed: boolean) => {
    try {
      // Pass current user ID when marking as completed
      const updated = await updateChecklistItem(
        itemId,
        { completed: !completed },
        !completed ? currentUser?.id : undefined
      );
      setChecklists(checklists.map((c) =>
        c.id === checklistId
          ? { ...c, items: updateItemInList(c.items, itemId, () => updated) }
          : c
      ));
    } catch (err) {
      console.error('Failed to update checklist item:', err);
    }
  };

  const handleDeleteChecklistItem = async (checklistId: string, itemId: string) => {
    try {
      await deleteChecklistItem(itemId);
      setChecklists(checklists.map((c) =>
        c.id === checklistId
          ? { ...c, items: removeItemFromList(c.items, itemId) }
          : c
      ));
    } catch (err) {
      console.error('Failed to delete checklist item:', err);
    }
  };

  const handleUpdateChecklistItemDueDate = async (checklistId: string, itemId: string, dueDate: string | null) => {
    try {
      await updateChecklistItem(itemId, { dueDate });
      setChecklists(checklists.map((c) =>
        c.id === checklistId
          ? { ...c, items: updateItemInList(c.items, itemId, (item) => ({ ...item, dueDate: dueDate || undefined })) }
          : c
      ));
      setEditingItemDueDate(null);
    } catch (err) {
      console.error('Failed to update checklist item due date:', err);
    }
  };

  const handleUpdateChecklistItemAssignee = async (checklistId: string, itemId: string, assigneeId: string | null) => {
    try {
      const updated = await updateChecklistItemAssignee(itemId, assigneeId);
      setChecklists(checklists.map((c) =>
        c.id === checklistId
          ? { ...c, items: updateItemInList(c.items, itemId, (item) => ({
              ...item,
              assigneeId: updated.assigneeId,
              assignee: updated.assignee,
            })) }
          : c
      ));
      setEditingItemAssignee(null);
    } catch (err) {
      console.error('Failed to update checklist item assignee:', err);
    }
  };

  const getChecklistProgress = (checklist: Checklist) => {
    const { total, completed } = countChecklistItems(checklist.items);
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const getChecklistCounts = (checklist: Checklist) => {
    return countChecklistItems(checklist.items);
  };

  const loadActivities = async () => {
    try {
      setIsLoadingActivities(true);
      const cardActivities = await fetchActivitiesByCard(card.id);
      setActivities(cardActivities);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const formatActivityTime = (dateStr: string) => {
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleTitleBlur = () => {
    if (title.trim() && title !== card.title) {
      onUpdate(card.id, { title });
    } else {
      setTitle(card.title);
    }
  };

  const handleDescriptionSave = () => {
    if (description !== card.description) {
      onUpdate(card.id, { description });
    }
    setEditingDescription(false);
  };

  const handleDueDateSave = (date: string) => {
    setDueDate(date);
    onUpdate(card.id, { dueDate: date || undefined });
    setShowDatePicker(false);
  };

  const handleRemoveDueDate = () => {
    setDueDate('');
    onUpdate(card.id, { dueDate: undefined });
    setShowDatePicker(false);
  };

  const handleStartDateSave = (date: string) => {
    setStartDate(date);
    onUpdate(card.id, { startDate: date || undefined });
    setShowStartDatePicker(false);
  };

  const handleRemoveStartDate = () => {
    setStartDate('');
    onUpdate(card.id, { startDate: undefined });
    setShowStartDatePicker(false);
  };

  const toggleLabel = (label: CardLabel) => {
    const currentLabels = card.labels || [];
    const newLabels = currentLabels.includes(label)
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];
    onUpdate(card.id, { labels: newLabels });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
        {/* Cover Image */}
        {coverImageUrl && (
          <div className="relative h-40 w-full">
            <div
              className="absolute inset-0 bg-cover bg-center rounded-t-xl"
              style={{ backgroundImage: `url(${coverImageUrl})` }}
            />
            <button
              onClick={handleRemoveCover}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Remove cover
            </button>
          </div>
        )}

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 flex-1">
              {/* Completion Toggle */}
              <button
                onClick={() => onUpdate(card.id, { completed: !card.completed })}
                className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  card.completed
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-green-400'
                }`}
                title={card.completed ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {card.completed && <Check className="h-4 w-4" />}
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  className={`text-xl font-semibold w-full outline-none focus:bg-gray-50 px-2 py-1 -ml-2 rounded ${
                    card.completed ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}
                />
                <p className="text-sm text-gray-500 mt-1">
                  in list <span className="underline">{listTitle}</span>
                  {card.completed && <span className="ml-2 text-green-600 font-medium">Completed</span>}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {/* Main Content - 75% */}
            <div className="col-span-3 space-y-6">
              {/* Labels */}
              {card.labels.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Labels</h4>
                  <div className="flex flex-wrap gap-2">
                    {card.labels.map((label) => (
                      <span
                        key={label}
                        className="px-3 py-1 rounded text-white text-sm font-medium"
                        style={{ backgroundColor: LABEL_COLORS[label] }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Date Display */}
              {startDate && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Start Date</h4>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-700">
                      <Clock className="h-4 w-4 mr-2" />
                      {new Date(startDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: new Date(startDate).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })}
                      {' '}
                      {new Date(startDate).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                    <button
                      onClick={() => setShowStartDatePicker(true)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {/* Due Date Display */}
              {dueDate && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Due Date</h4>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium ${
                      new Date(dueDate) < new Date() ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(dueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: new Date(dueDate).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })}
                      {' '}
                      {new Date(dueDate).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                      {new Date(dueDate) < new Date() && ' (overdue)'}
                    </span>
                    <button
                      onClick={() => setShowDatePicker(true)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                {editingDescription ? (
                  <div>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 resize-none"
                      rows={4}
                      autoFocus
                    />
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={handleDescriptionSave}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setDescription(card.description || '');
                          setEditingDescription(false);
                        }}
                        className="text-gray-600 px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingDescription(true)}
                    className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-20"
                  >
                    {card.description || 'Add a more detailed description...'}
                  </button>
                )}
              </div>

              {/* Custom Fields - Main Content Area */}
              {displayableFieldDefs.filter(f => f.displayLocation === 'main' || !f.displayLocation).length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Fields</h4>
                  <div className="space-y-4">
                    {displayableFieldDefs
                      .filter(fieldDef => fieldDef.displayLocation === 'main' || !fieldDef.displayLocation)
                      .map((fieldDef) => {
                        const currentValue = customFieldValueMap.get(fieldDef.id) || '';
                        return (
                          <div key={fieldDef.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium text-gray-600">
                                {fieldDef.title}
                                {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                                {fieldDef.scope === 'card' && (
                                  <span className="ml-2 text-xs text-gray-400 font-normal">(card-specific)</span>
                                )}
                              </label>
                              {fieldDef.scope === 'card' && (
                                <button
                                  onClick={() => handleRemoveCardField(fieldDef.id)}
                                  disabled={isAddingCardField}
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title="Remove field from this card"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Remove</span>
                                </button>
                              )}
                            </div>

                            {fieldDef.type === 'text' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                    placeholder={`Enter ${fieldDef.title.toLowerCase()}`}
                                    autoFocus
                                  />
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue || `Add ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'longtext' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <textarea
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    rows={4}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-y"
                                    placeholder={`Enter ${fieldDef.title.toLowerCase()}`}
                                    autoFocus
                                  />
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-20"
                                >
                                  {currentValue || `Add ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'number' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <input
                                    type="number"
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                    placeholder="0"
                                    autoFocus
                                  />
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue || `Enter ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'date' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <input
                                    type="date"
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                    autoFocus
                                  />
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue ? new Date(currentValue).toLocaleDateString() : `Select ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'dropdown' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <select
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                                    autoFocus
                                  >
                                    <option value="">Select {fieldDef.title.toLowerCase()}</option>
                                    {fieldDef.options.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue || `Select ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'checkbox' && (
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentValue === 'true'}
                                  onChange={(e) => {
                                    const newValue = e.target.checked ? 'true' : 'false';
                                    setCustomFieldValueMap((prev) => {
                                      const newMap = new Map(prev);
                                      newMap.set(fieldDef.id, newValue);
                                      return newMap;
                                    });
                                    handleCustomFieldChange(fieldDef.id, newValue);
                                  }}
                                  disabled={isSavingCustomField}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">{fieldDef.title}</span>
                              </label>
                            )}

                            {fieldDef.type === 'url' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <input
                                    type="url"
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                    placeholder="https://example.com"
                                    autoFocus
                                  />
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue ? (
                                    <a href={currentValue} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                                      {currentValue}
                                    </a>
                                  ) : `Add ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'email' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <input
                                    type="email"
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                    placeholder="email@example.com"
                                    autoFocus
                                  />
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue ? (
                                    <a href={`mailto:${currentValue}`} className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                                      {currentValue}
                                    </a>
                                  ) : `Add ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'currency' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={currentValue}
                                      onChange={(e) => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          newMap.set(fieldDef.id, e.target.value);
                                          return newMap;
                                        });
                                      }}
                                      disabled={isSavingCustomField}
                                      className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                      placeholder="0.00"
                                      autoFocus
                                    />
                                  </div>
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue ? `$${parseFloat(currentValue).toFixed(2)}` : `Add ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}

                            {fieldDef.type === 'rating' && (
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => {
                                      const newValue = star.toString();
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, newValue);
                                        return newMap;
                                      });
                                      handleCustomFieldChange(fieldDef.id, newValue);
                                    }}
                                    disabled={isSavingCustomField}
                                    className="p-0.5 hover:scale-110 transition-transform disabled:opacity-50"
                                  >
                                    <svg
                                      className={`w-6 h-6 ${
                                        parseInt(currentValue || '0') >= star
                                          ? 'text-yellow-400 fill-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </button>
                                ))}
                                {currentValue && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, '');
                                        return newMap;
                                      });
                                      handleCustomFieldChange(fieldDef.id, '');
                                    }}
                                    className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            )}

                            {fieldDef.type === 'phone' && (
                              editingCustomFieldId === fieldDef.id ? (
                                <div>
                                  <input
                                    type="tel"
                                    value={currentValue}
                                    onChange={(e) => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(fieldDef.id, e.target.value);
                                        return newMap;
                                      });
                                    }}
                                    disabled={isSavingCustomField}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                    placeholder="+1 (555) 000-0000"
                                    autoFocus
                                  />
                                  <div className="flex space-x-2 mt-2">
                                    <button
                                      onClick={() => {
                                        handleCustomFieldChange(fieldDef.id, currentValue);
                                        setEditingCustomFieldId(null);
                                      }}
                                      disabled={isSavingCustomField}
                                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setCustomFieldValueMap((prev) => {
                                          const newMap = new Map(prev);
                                          const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                          newMap.set(fieldDef.id, originalValue);
                                          return newMap;
                                        });
                                        setEditingCustomFieldId(null);
                                      }}
                                      className="text-gray-600 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-10"
                                >
                                  {currentValue ? (
                                    <a href={`tel:${currentValue}`} className="text-blue-600 hover:underline" onClick={e => e.stopPropagation()}>
                                      {currentValue}
                                    </a>
                                  ) : `Add ${fieldDef.title.toLowerCase()}...`}
                                </button>
                              )
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Card Relationships */}
              <div className="border-t pt-4 mt-4">
                <CardRelationships cardId={card.id} boardId={boardId} />
              </div>

              {/* Checklists */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Checklists
                  </h4>
                  {!showAddChecklist && (
                    <button
                      onClick={() => setShowAddChecklist(true)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Add checklist
                    </button>
                  )}
                </div>

                {/* Add checklist form */}
                {showAddChecklist && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                      placeholder="Checklist title..."
                      autoFocus
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={handleAddChecklist}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setShowAddChecklist(false);
                          setNewChecklistTitle('');
                        }}
                        className="text-gray-600 px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Checklists list */}
                {isLoadingChecklists ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : checklists.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No checklists yet</p>
                ) : (
                  <div className="space-y-4">
                    {checklists.map((checklist) => (
                      <div key={checklist.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        {/* Checklist Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="h-5 w-5 text-blue-600" />
                            <h5 className="font-semibold text-gray-800">{checklist.title}</h5>
                          </div>
                          <button
                            onClick={() => handleDeleteChecklist(checklist.id)}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Progress bar */}
                        {checklist.items.length > 0 && (
                          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                              <span className="font-medium">Progress</span>
                              <span className="font-semibold text-blue-600">
                                {getChecklistCounts(checklist).completed}/{getChecklistCounts(checklist).total} completed
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ease-out rounded-full ${
                                  getChecklistProgress(checklist) === 100
                                    ? 'bg-gradient-to-r from-green-500 to-green-400'
                                    : 'bg-gradient-to-r from-blue-600 to-blue-400'
                                }`}
                                style={{ width: `${getChecklistProgress(checklist)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Items - Recursive renderer */}
                        <div className="px-2 py-2">
                          {(function renderItems(items: ChecklistItem[], depth = 0): React.ReactNode {
                            return items.map((item) => (
                              <div key={item.id}>
                                <div
                                  className={`flex items-center group py-2 px-2 rounded-lg transition-colors ${
                                    item.completed ? 'bg-green-50/50' : 'hover:bg-gray-50'
                                  }`}
                                  style={{ marginLeft: `${depth * 20}px` }}
                                >
                                  {/* Nested indicator line */}
                                  {depth > 0 && (
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 rounded-full" />
                                  )}
                                  <button
                                    onClick={() => handleToggleChecklistItem(checklist.id, item.id, item.completed)}
                                    className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 transition-all duration-200 ${
                                      item.completed
                                        ? 'bg-green-500 border-green-500 text-white shadow-sm'
                                        : 'border-gray-300 hover:border-blue-500 hover:shadow-sm'
                                    }`}
                                  >
                                    {item.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm transition-colors ${
                                      item.completed ? 'line-through text-gray-400' : 'text-gray-700 font-medium'
                                    }`}>
                                      {item.title}
                                    </span>
                                    {/* Completion details */}
                                    {item.completed && item.completedBy && (
                                      <div className="text-xs text-gray-400 mt-0.5">
                                        Completed by {item.completedBy.name}
                                        {item.completedAt && (
                                          <span> • {new Date(item.completedAt).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                          })}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {/* Assignee */}
                                  <div className="relative mr-2">
                                    {item.assignee ? (
                                      <button
                                        onClick={() => setEditingItemAssignee(`${item.id}-${checklist.id}`)}
                                        className="flex items-center hover:bg-gray-100 rounded px-1 py-0.5"
                                        title={`Assigned to ${item.assignee.name}`}
                                      >
                                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                                          {item.assignee.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-xs text-gray-500 ml-1 hidden sm:inline">
                                          {item.assignee.name.split(' ')[0]}
                                        </span>
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => setEditingItemAssignee(`${item.id}-${checklist.id}`)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-1"
                                        title="Assign member"
                                      >
                                        <User className="h-3 w-3" />
                                      </button>
                                    )}
                                    {editingItemAssignee === `${item.id}-${checklist.id}` && (
                                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border p-2 z-50 min-w-48">
                                        <div className="text-xs font-medium text-gray-500 mb-2">Assign to</div>
                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                          {workspaceMembers.map((member) => (
                                            <button
                                              key={member.id}
                                              onClick={() => handleUpdateChecklistItemAssignee(checklist.id, item.id, member.id)}
                                              className={`w-full flex items-center px-2 py-1.5 rounded text-sm hover:bg-gray-100 ${
                                                item.assigneeId === member.id ? 'bg-blue-50' : ''
                                              }`}
                                            >
                                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium mr-2">
                                                {member.displayName.charAt(0).toUpperCase()}
                                              </div>
                                              <span className="flex-1 text-left">{member.displayName}</span>
                                              {item.assigneeId === member.id && (
                                                <Check className="h-3 w-3 text-blue-500" />
                                              )}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex justify-between mt-2 pt-2 border-t">
                                          {item.assignee && (
                                            <button
                                              onClick={() => handleUpdateChecklistItemAssignee(checklist.id, item.id, null)}
                                              className="text-xs text-red-600 hover:text-red-700"
                                            >
                                              Remove
                                            </button>
                                          )}
                                          <button
                                            onClick={() => setEditingItemAssignee(null)}
                                            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {/* Due date */}
                                  <div className="relative">
                                    {item.dueDate && !editingItemDueDate?.startsWith(item.id) && (
                                      <button
                                        onClick={() => setEditingItemDueDate(`${item.id}-${checklist.id}`)}
                                        className={`mr-1 text-xs px-1.5 py-0.5 rounded flex items-center ${
                                          new Date(item.dueDate) < new Date() && !item.completed
                                            ? 'bg-red-100 text-red-700'
                                            : item.completed
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}
                                      >
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(item.dueDate).toLocaleDateString()}
                                      </button>
                                    )}
                                    {!item.dueDate && (
                                      <button
                                        onClick={() => setEditingItemDueDate(`${item.id}-${checklist.id}`)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-1 mr-1"
                                        title="Set due date"
                                      >
                                        <Calendar className="h-3 w-3" />
                                      </button>
                                    )}
                                    {editingItemDueDate === `${item.id}-${checklist.id}` && (
                                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border p-2 z-50">
                                        <input
                                          type="date"
                                          defaultValue={item.dueDate || ''}
                                          onChange={(e) => handleUpdateChecklistItemDueDate(checklist.id, item.id, e.target.value || null)}
                                          className="px-2 py-1 border rounded text-sm"
                                          autoFocus
                                        />
                                        <div className="flex justify-between mt-2">
                                          {item.dueDate && (
                                            <button
                                              onClick={() => handleUpdateChecklistItemDueDate(checklist.id, item.id, null)}
                                              className="text-xs text-red-600 hover:text-red-700"
                                            >
                                              Remove
                                            </button>
                                          )}
                                          <button
                                            onClick={() => setEditingItemDueDate(null)}
                                            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {/* Add sub-item button (if under max depth) */}
                                  {depth < MAX_NESTING_DEPTH - 1 && (
                                    <button
                                      onClick={() => setAddingSubItemTo({ checklistId: checklist.id, parentId: item.id })}
                                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 p-1"
                                      title="Add sub-item"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteChecklistItem(checklist.id, item.id)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                                {/* Sub-item input form */}
                                {addingSubItemTo?.checklistId === checklist.id && addingSubItemTo?.parentId === item.id && (
                                  <div className="mt-1 mb-2" style={{ paddingLeft: `${(depth + 1) * 24}px` }}>
                                    <input
                                      type="text"
                                      value={newItemTitle}
                                      onChange={(e) => setNewItemTitle(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem(checklist.id, item.id)}
                                      placeholder="Add a sub-item..."
                                      autoFocus
                                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                    />
                                    <div className="flex space-x-2 mt-1">
                                      <button
                                        onClick={() => handleAddChecklistItem(checklist.id, item.id)}
                                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700"
                                      >
                                        Add
                                      </button>
                                      <button
                                        onClick={() => {
                                          setAddingSubItemTo(null);
                                          setNewItemTitle('');
                                        }}
                                        className="text-gray-600 px-2 py-1 text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {/* Render children recursively */}
                                {item.children && item.children.length > 0 && renderItems(item.children, depth + 1)}
                              </div>
                            ));
                          })(checklist.items)}
                        </div>

                        {/* Add item */}
                        {addingItemToChecklist === checklist.id ? (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={newItemTitle}
                              onChange={(e) => setNewItemTitle(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem(checklist.id)}
                              placeholder="Add an item..."
                              autoFocus
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                            />
                            <div className="flex space-x-2 mt-2">
                              <button
                                onClick={() => handleAddChecklistItem(checklist.id)}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
                              >
                                Add item
                              </button>
                              <button
                                onClick={() => {
                                  setAddingItemToChecklist(null);
                                  setNewItemTitle('');
                                }}
                                className="text-gray-600 hover:text-gray-800 px-3 py-1.5 text-sm hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingItemToChecklist(checklist.id)}
                            className="mt-2 w-full py-2 px-3 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center rounded-lg border border-dashed border-gray-300 hover:border-gray-400 transition-colors"
                          >
                            <Plus className="h-4 w-4 mr-2 text-gray-400" />
                            Add an item
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachments */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-lg transition-colors ${isDragOver ? 'bg-blue-50 ring-2 ring-blue-400 ring-dashed' : ''}`}
              >
                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 rounded-lg z-10">
                    <div className="text-center">
                      <Upload className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-blue-600 font-medium">Drop files to upload</p>
                    </div>
                  </div>
                )}
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attachments
                </h4>

                {/* Upload button */}
                <label className="inline-flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer mb-3">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  <span className="text-sm">{isUploading ? 'Uploading...' : 'Add attachment'}</span>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>

                {/* Drag and drop hint */}
                <p className="text-xs text-gray-400 mb-3">or drag and drop files here</p>

                {/* Attachments list */}
                {isLoadingAttachments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : attachments.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No attachments yet</p>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg p-3 hover:bg-gray-100"
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          {getFileIcon(attachment.mimeType)}
                          <div className="ml-3 flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{attachment.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize)}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          <a
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-blue-600"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Comments
                </h4>

                {/* Add comment form */}
                <div className="relative">
                  <div className="flex space-x-2 mb-4">
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={newComment}
                      onChange={handleCommentChange}
                      onKeyDown={handleCommentKeyDown}
                      placeholder="Write a comment... (use @ to mention)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Mention suggestions dropdown */}
                  {showMentionSuggestions && filteredMentionMembers.length > 0 && (
                    <div className="absolute left-0 bottom-full mb-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-48 overflow-y-auto">
                      <div className="px-3 py-1 text-xs text-gray-500 uppercase border-b">
                        Mention someone
                      </div>
                      {filteredMentionMembers.slice(0, 5).map((member, index) => (
                        <button
                          key={member.id}
                          onClick={() => handleSelectMention(member)}
                          className={`w-full px-3 py-2 flex items-center text-left hover:bg-gray-100 ${
                            index === mentionIndex ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium mr-3">
                            {member.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.displayName}
                            </div>
                            {member.email && (
                              <div className="text-xs text-gray-500">{member.email}</div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comments list */}
                {isLoadingComments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No comments yet</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center mb-1">
                            <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium mr-2">
                              {comment.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-800">{comment.authorName}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {new Date(comment.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.text);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {editingCommentId === comment.id ? (
                          <div className="mt-2">
                            <textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex space-x-2 mt-2">
                              <button
                                onClick={() => handleUpdateComment(comment.id)}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText('');
                                }}
                                className="text-gray-600 px-3 py-1 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 ml-9">{comment.text}</p>
                        )}

                        {/* Reactions */}
                        <div className="ml-9 mt-2 flex items-center flex-wrap gap-1">
                          {/* Existing reactions */}
                          {comment.reactions.map((reaction) => (
                            <button
                              key={reaction.type}
                              onClick={() => handleToggleReaction(comment.id, reaction.type)}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                                currentUser && (reaction.userIds || []).includes(currentUser.id)
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <span className="mr-1">{reaction.type}</span>
                              <span className="text-gray-600">{(reaction.userIds || []).length}</span>
                            </button>
                          ))}

                          {/* Add reaction button */}
                          <div className="relative">
                            <button
                              onClick={() => setShowReactionPicker(showReactionPicker === comment.id ? null : comment.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                              title="Add reaction"
                            >
                              <SmilePlus className="h-4 w-4" />
                            </button>
                            {showReactionPicker === comment.id && (
                              <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border p-2 flex gap-1 z-50">
                                {(['👍', '👎', '❤️', '😄', '🎉', '😮'] as ReactionType[]).map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      handleToggleReaction(comment.id, emoji);
                                      setShowReactionPicker(null);
                                    }}
                                    className="p-1.5 hover:bg-gray-100 rounded text-lg"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center justify-between">
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Activity
                    {activities.length > 0 && (
                      <span className="ml-2 text-xs text-gray-400 font-normal">({activities.length})</span>
                    )}
                  </span>
                  {activities.length > 5 && (
                    <button
                      onClick={() => setShowAllActivities(!showAllActivities)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-normal"
                    >
                      {showAllActivities ? 'Show less' : 'Show all'}
                    </button>
                  )}
                </h4>

                {isLoadingActivities ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No activity yet</p>
                ) : (
                  <div className={`space-y-3 ${showAllActivities ? 'max-h-96 overflow-y-auto pr-2' : ''}`}>
                    {(showAllActivities ? activities : activities.slice(0, 5)).map((activity) => {
                      const display = getActivityDisplay(activity.type);
                      return (
                        <div key={activity.id} className="flex items-start">
                          <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs mr-2 flex-shrink-0">
                            {activity.authorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">{activity.authorName}</span>{' '}
                              <span>{display.label}</span>
                            </p>
                            {activity.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">{formatActivityTime(activity.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })}
                    {!showAllActivities && activities.length > 5 && (
                      <button
                        onClick={() => setShowAllActivities(true)}
                        className="w-full text-xs text-blue-600 hover:text-blue-700 text-center py-2 hover:bg-blue-50 rounded"
                      >
                        Show {activities.length - 5} more activities
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Actions */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2 flex items-center gap-2">
                  Add to card
                  {cardMembers.length > 0 && (
                    <span className="text-blue-600 normal-case font-normal">
                      • {cardMembers[0].name}
                    </span>
                  )}
                </h4>
                <div className="space-y-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowMemberPicker(!showMemberPicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center justify-between"
                    >
                      <span className="flex items-center">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Members
                      </span>
                      {cardMembers.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                            {cardMembers[0].name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                      )}
                    </button>
                    {showMemberPicker && (
                      <>
                        <div className="fixed inset-0 z-[51]" onClick={() => setShowMemberPicker(false)} />
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-[52] w-64">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Assign member (1 max)</h5>
                        {cardMembers.length > 0 && (
                          <div className="mb-3 p-2 bg-blue-50 rounded">
                            <p className="text-xs text-blue-700 mb-2">Currently assigned:</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                                  {cardMembers[0].name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm text-gray-700">{cardMembers[0].name}</span>
                              </div>
                              <button
                                onClick={() => handleToggleMember(cardMembers[0].id, cardMembers[0].name)}
                                disabled={isTogglingMember}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {currentUser && !cardMembers.some((m) => m.id === currentUser.id) && (
                            <button
                              onClick={() => handleToggleMember(currentUser.id, currentUser.displayName || currentUser.username)}
                              disabled={isTogglingMember}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 text-left disabled:opacity-50"
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                                {(currentUser.displayName || currentUser.username).charAt(0).toUpperCase()}
                              </div>
                              <span className="flex-1 text-sm text-gray-700">
                                {currentUser.displayName || currentUser.username}
                              </span>
                            </button>
                          )}
                          {cardMembers.length > 0 && !cardMembers.some((m) => m.id === currentUser?.id) && (
                            <p className="text-xs text-gray-500 px-2 py-1">Remove current member to assign yourself</p>
                          )}
                        </div>
                          <button
                            onClick={() => setShowMemberPicker(false)}
                            className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleToggleWatch}
                    disabled={isTogglingWatch || !currentUser}
                    className={`w-full px-3 py-2 rounded text-left text-sm flex items-center ${
                      isWatching
                        ? 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    } disabled:opacity-50`}
                  >
                    {isTogglingWatch ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : isWatching ? (
                      <Eye className="h-4 w-4 mr-2" />
                    ) : (
                      <EyeOff className="h-4 w-4 mr-2" />
                    )}
                    {isWatching ? 'Watching' : 'Watch'}
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowWatchersPicker(!showWatchersPicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center justify-between"
                    >
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Add Watchers
                      </span>
                      {card.watcherIds && card.watcherIds.length > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                          {card.watcherIds.length}
                        </span>
                      )}
                    </button>
                    {showWatchersPicker && (
                      <>
                        <div className="fixed inset-0 z-[51]" onClick={() => setShowWatchersPicker(false)} />
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-[52] w-64">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Add Watchers</h5>
                        {/* Current watchers */}
                        {card.watcherIds && card.watcherIds.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-2">Current watchers:</p>
                            <div className="space-y-1">
                              {workspaceMembers
                                .filter((m) => card.watcherIds.includes(m.id))
                                .map((member) => (
                                  <div
                                    key={member.id}
                                    className="flex items-center justify-between py-1 px-2 bg-blue-50 rounded"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                                        {(member.displayName).charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm text-gray-700">
                                        {member.displayName}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveWatcher(member.id, member.displayName)}
                                      disabled={isAddingWatcher}
                                      className="text-red-500 hover:text-red-700 text-xs"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                        {/* Available members to add as watchers */}
                        <p className="text-xs text-gray-500 mb-2">Add team member:</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {workspaceMembers
                            .filter((m) => !card.watcherIds?.includes(m.id))
                            .map((member) => (
                              <button
                                key={member.id}
                                onClick={() => handleAddWatcher(member.id, member.displayName)}
                                disabled={isAddingWatcher}
                                className="w-full flex items-center gap-2 p-2 rounded hover:bg-gray-100 disabled:opacity-50"
                              >
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium">
                                  {(member.displayName).charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm text-gray-700">
                                  {member.displayName}
                                </span>
                              </button>
                            ))}
                          {workspaceMembers.filter((m) => !card.watcherIds?.includes(m.id)).length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-2">All members are watching</p>
                          )}
                        </div>
                          <button
                            onClick={() => setShowWatchersPicker(false)}
                            className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center">
                    <Tag className="h-4 w-4 mr-2" />
                    Labels
                  </button>
                  {/* Department Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDepartmentPicker(!showDepartmentPicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center justify-between"
                    >
                      <span className="flex items-center">
                        <Briefcase className="h-4 w-4 mr-2" />
                        Department
                      </span>
                      {card.department && (
                        <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded">
                          {card.department.name}
                        </span>
                      )}
                    </button>
                    {showDepartmentPicker && (
                      <>
                        <div className="fixed inset-0 z-[51]" onClick={() => setShowDepartmentPicker(false)} />
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-[52] w-64">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Select Department</h5>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {departments.map((dept) => (
                            <button
                              key={dept.id}
                              onClick={() => handleDepartmentChange(dept.id)}
                              disabled={isUpdatingDepartment}
                              className={`w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 text-left disabled:opacity-50 ${
                                card.department?.id === dept.id ? 'bg-purple-50 border border-purple-200' : ''
                              }`}
                            >
                              <Briefcase className="h-4 w-4 text-purple-600" />
                              <span className="text-sm text-gray-700">{dept.name}</span>
                              {card.department?.id === dept.id && (
                                <Check className="h-4 w-4 text-purple-600 ml-auto" />
                              )}
                            </button>
                          ))}
                          {departments.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-2">No departments available</p>
                          )}
                        </div>
                        {card.department && (
                          <button
                            onClick={() => handleDepartmentChange(null)}
                            disabled={isUpdatingDepartment}
                            className="w-full mt-2 text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove Department
                          </button>
                        )}
                          <button
                            onClick={() => setShowDepartmentPicker(false)}
                            className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Client Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowClientPicker(!showClientPicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center justify-between"
                    >
                      <span className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2" />
                        Client
                      </span>
                      {card.client && (
                        <span className="bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded">
                          {card.client.name}
                        </span>
                      )}
                    </button>
                    {showClientPicker && (
                      <>
                        <div className="fixed inset-0 z-[51]" onClick={() => setShowClientPicker(false)} />
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-[52] w-64">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Select Client</h5>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {clients.map((clnt) => (
                            <button
                              key={clnt.id}
                              onClick={() => handleClientChange(clnt.id)}
                              disabled={isUpdatingClient}
                              className={`w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 text-left disabled:opacity-50 ${
                                card.client?.id === clnt.id ? 'bg-teal-50 border border-teal-200' : ''
                              }`}
                            >
                              <Building2 className="h-4 w-4 text-teal-600" />
                              <span className="text-sm text-gray-700">{clnt.name}</span>
                              {card.client?.id === clnt.id && (
                                <Check className="h-4 w-4 text-teal-600 ml-auto" />
                              )}
                            </button>
                          ))}
                          {clients.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-2">No clients available</p>
                          )}
                        </div>
                        {card.client && (
                          <button
                            onClick={() => handleClientChange(null)}
                            disabled={isUpdatingClient}
                            className="w-full mt-2 text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove Client
                          </button>
                        )}
                          <button
                            onClick={() => setShowClientPicker(false)}
                            className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Add Card-Scoped Custom Fields */}
                  {availableCardFields.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowCardFieldsPicker(!showCardFieldsPicker)}
                        className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center justify-between"
                      >
                        <span className="flex items-center">
                          <Settings2 className="h-4 w-4 mr-2" />
                          Custom Fields
                        </span>
                        <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                          {availableCardFields.length}
                        </span>
                      </button>
                      {showCardFieldsPicker && (
                        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10 w-64">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Add Custom Fields</h5>
                          <p className="text-xs text-gray-500 mb-3">Select card-specific fields to add:</p>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {availableCardFields.map((field) => (
                              <button
                                key={field.id}
                                onClick={() => handleAddCardField(field.id)}
                                disabled={isAddingCardField}
                                className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 text-left disabled:opacity-50"
                              >
                                <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                                  {field.type === 'text' && <span className="text-blue-600 text-xs font-medium">Aa</span>}
                                  {field.type === 'number' && <span className="text-blue-600 text-xs font-medium">#</span>}
                                  {field.type === 'date' && <Calendar className="h-3 w-3 text-blue-600" />}
                                  {field.type === 'dropdown' && <ChevronDown className="h-3 w-3 text-blue-600" />}
                                  {field.type === 'checkbox' && <CheckSquare className="h-3 w-3 text-blue-600" />}
                                  {field.type === 'url' && <Link2 className="h-3 w-3 text-blue-600" />}
                                  {field.type === 'email' && <Mail className="h-3 w-3 text-blue-600" />}
                                  {field.type === 'currency' && <span className="text-blue-600 text-xs font-medium">$</span>}
                                  {field.type === 'rating' && <Star className="h-3 w-3 text-blue-600" />}
                                  {field.type === 'phone' && <Phone className="h-3 w-3 text-blue-600" />}
                                  {field.type === 'longtext' && <FileText className="h-3 w-3 text-blue-600" />}
                                </div>
                                <div className="flex-1">
                                  <span className="text-sm text-gray-700">{field.title}</span>
                                  <span className="block text-xs text-gray-400 capitalize">{field.type}</span>
                                </div>
                                <Plus className="h-4 w-4 text-gray-400" />
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setShowCardFieldsPicker(false)}
                            className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="relative">
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Due date
                    </button>
                    {showDatePicker && (
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10 w-72">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Set due date & time</h5>
                        <input
                          type="datetime-local"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex space-x-2 mt-3">
                          <button
                            onClick={() => handleDueDateSave(dueDate)}
                            className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                          >
                            Save
                          </button>
                          {card.dueDate && (
                            <button
                              onClick={handleRemoveDueDate}
                              className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setShowDatePicker(false)}
                          className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Start date
                    </button>
                    {showStartDatePicker && (
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10 w-72">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Set start date & time</h5>
                        <input
                          type="datetime-local"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                        />
                        <div className="flex space-x-2 mt-3">
                          <button
                            onClick={() => handleStartDateSave(startDate)}
                            className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                          >
                            Save
                          </button>
                          {card.startDate && (
                            <button
                              onClick={handleRemoveStartDate}
                              className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setShowStartDatePicker(false)}
                          className="w-full mt-2 text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <label className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center cursor-pointer">
                      <Image className="h-4 w-4 mr-2" />
                      {isUploadingCover ? 'Uploading...' : 'Cover'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                        disabled={isUploadingCover}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Labels</h4>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(LABEL_COLORS) as CardLabel[]).map((label) => (
                    <button
                      key={label}
                      onClick={() => toggleLabel(label)}
                      className={`w-8 h-6 rounded ${
                        (card.labels || []).includes(label) ? 'ring-2 ring-offset-1 ring-gray-600' : ''
                      }`}
                      style={{ backgroundColor: LABEL_COLORS[label] }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Fields Section - Sidebar Only */}
              {displayableFieldDefs.filter(f => f.displayLocation === 'sidebar').length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Custom Fields</h4>
                  <div className="space-y-3">
                    {displayableFieldDefs.filter(f => f.displayLocation === 'sidebar').map((fieldDef) => {
                      const currentValue = customFieldValueMap.get(fieldDef.id) || '';

                      return (
                        <div key={fieldDef.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-600">
                              {fieldDef.title}
                              {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {fieldDef.scope === 'card' && (
                              <button
                                onClick={() => handleRemoveCardField(fieldDef.id)}
                                disabled={isAddingCardField}
                                className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                                title="Remove field"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          {fieldDef.type === 'text' && (
                            editingCustomFieldId === fieldDef.id ? (
                              <div>
                                <input
                                  type="text"
                                  value={currentValue}
                                  onChange={(e) => {
                                    setCustomFieldValueMap((prev) => {
                                      const newMap = new Map(prev);
                                      newMap.set(fieldDef.id, e.target.value);
                                      return newMap;
                                    });
                                  }}
                                  disabled={isSavingCustomField}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                                  placeholder={`Enter ${fieldDef.title.toLowerCase()}`}
                                  autoFocus
                                />
                                <div className="flex space-x-2 mt-1.5">
                                  <button
                                    onClick={() => {
                                      handleCustomFieldChange(fieldDef.id, currentValue);
                                      setEditingCustomFieldId(null);
                                    }}
                                    disabled={isSavingCustomField}
                                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                        newMap.set(fieldDef.id, originalValue);
                                        return newMap;
                                      });
                                      setEditingCustomFieldId(null);
                                    }}
                                    className="text-gray-600 px-2 py-1 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                className="w-full text-left px-2 py-1.5 bg-gray-100 rounded text-sm text-gray-600 hover:bg-gray-200"
                              >
                                {currentValue || `Add ${fieldDef.title.toLowerCase()}...`}
                              </button>
                            )
                          )}

                          {fieldDef.type === 'number' && (
                            editingCustomFieldId === fieldDef.id ? (
                              <div>
                                <input
                                  type="number"
                                  value={currentValue}
                                  onChange={(e) => {
                                    setCustomFieldValueMap((prev) => {
                                      const newMap = new Map(prev);
                                      newMap.set(fieldDef.id, e.target.value);
                                      return newMap;
                                    });
                                  }}
                                  disabled={isSavingCustomField}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                                  placeholder="0"
                                  autoFocus
                                />
                                <div className="flex space-x-2 mt-1.5">
                                  <button
                                    onClick={() => {
                                      handleCustomFieldChange(fieldDef.id, currentValue);
                                      setEditingCustomFieldId(null);
                                    }}
                                    disabled={isSavingCustomField}
                                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCustomFieldValueMap((prev) => {
                                        const newMap = new Map(prev);
                                        const originalValue = initialCustomFieldValues.find(v => v.definitionId === fieldDef.id)?.value || '';
                                        newMap.set(fieldDef.id, originalValue);
                                        return newMap;
                                      });
                                      setEditingCustomFieldId(null);
                                    }}
                                    className="text-gray-600 px-2 py-1 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                className="w-full text-left px-2 py-1.5 bg-gray-100 rounded text-sm text-gray-600 hover:bg-gray-200"
                              >
                                {currentValue || `Enter ${fieldDef.title.toLowerCase()}...`}
                              </button>
                            )
                          )}

                          {fieldDef.type === 'date' && (
                            <input
                              type="date"
                              value={currentValue}
                              onChange={(e) => {
                                setCustomFieldValueMap((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(fieldDef.id, e.target.value);
                                  return newMap;
                                });
                                handleCustomFieldChange(fieldDef.id, e.target.value);
                              }}
                              disabled={isSavingCustomField}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                            />
                          )}

                          {fieldDef.type === 'dropdown' && (
                            <select
                              value={currentValue}
                              onChange={(e) => {
                                setCustomFieldValueMap((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(fieldDef.id, e.target.value);
                                  return newMap;
                                });
                                handleCustomFieldChange(fieldDef.id, e.target.value);
                              }}
                              disabled={isSavingCustomField}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500 bg-white"
                            >
                              <option value="">Select {fieldDef.title.toLowerCase()}</option>
                              {fieldDef.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}

                          {fieldDef.type === 'checkbox' && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={currentValue === 'true'}
                                onChange={(e) => {
                                  const newValue = e.target.checked ? 'true' : 'false';
                                  setCustomFieldValueMap((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.set(fieldDef.id, newValue);
                                    return newMap;
                                  });
                                  handleCustomFieldChange(fieldDef.id, newValue);
                                }}
                                disabled={isSavingCustomField}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{fieldDef.title}</span>
                            </label>
                          )}

                          {fieldDef.type === 'longtext' && (
                            <textarea
                              value={currentValue}
                              onChange={(e) => {
                                setCustomFieldValueMap((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(fieldDef.id, e.target.value);
                                  return newMap;
                                });
                              }}
                              onBlur={() => handleCustomFieldChange(fieldDef.id, currentValue)}
                              disabled={isSavingCustomField}
                              rows={3}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500 resize-y"
                              placeholder={`Enter ${fieldDef.title.toLowerCase()}`}
                            />
                          )}

                          {fieldDef.type === 'url' && (
                            <input
                              type="url"
                              value={currentValue}
                              onChange={(e) => {
                                setCustomFieldValueMap((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(fieldDef.id, e.target.value);
                                  return newMap;
                                });
                              }}
                              onBlur={() => handleCustomFieldChange(fieldDef.id, currentValue)}
                              disabled={isSavingCustomField}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                              placeholder="https://example.com"
                            />
                          )}

                          {fieldDef.type === 'email' && (
                            <input
                              type="email"
                              value={currentValue}
                              onChange={(e) => {
                                setCustomFieldValueMap((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(fieldDef.id, e.target.value);
                                  return newMap;
                                });
                              }}
                              onBlur={() => handleCustomFieldChange(fieldDef.id, currentValue)}
                              disabled={isSavingCustomField}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                              placeholder="email@example.com"
                            />
                          )}

                          {fieldDef.type === 'currency' && (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={currentValue}
                                onChange={(e) => {
                                  setCustomFieldValueMap((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.set(fieldDef.id, e.target.value);
                                    return newMap;
                                  });
                                }}
                                onBlur={() => handleCustomFieldChange(fieldDef.id, currentValue)}
                                disabled={isSavingCustomField}
                                className="w-full pl-6 pr-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                                placeholder="0.00"
                              />
                            </div>
                          )}

                          {fieldDef.type === 'rating' && (
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => {
                                    const newValue = star.toString();
                                    setCustomFieldValueMap((prev) => {
                                      const newMap = new Map(prev);
                                      newMap.set(fieldDef.id, newValue);
                                      return newMap;
                                    });
                                    handleCustomFieldChange(fieldDef.id, newValue);
                                  }}
                                  disabled={isSavingCustomField}
                                  className="p-0.5 hover:scale-110 transition-transform disabled:opacity-50"
                                >
                                  <svg
                                    className={`w-5 h-5 ${
                                      parseInt(currentValue || '0') >= star
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-gray-300'
                                    }`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                </button>
                              ))}
                              {currentValue && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomFieldValueMap((prev) => {
                                      const newMap = new Map(prev);
                                      newMap.set(fieldDef.id, '');
                                      return newMap;
                                    });
                                    handleCustomFieldChange(fieldDef.id, '');
                                  }}
                                  className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          )}

                          {fieldDef.type === 'phone' && (
                            <input
                              type="tel"
                              value={currentValue}
                              onChange={(e) => {
                                setCustomFieldValueMap((prev) => {
                                  const newMap = new Map(prev);
                                  newMap.set(fieldDef.id, e.target.value);
                                  return newMap;
                                });
                              }}
                              onBlur={() => handleCustomFieldChange(fieldDef.id, currentValue)}
                              disabled={isSavingCustomField}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                              placeholder="+1 (555) 000-0000"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Actions</h4>
                <div className="space-y-1">
                  {canEditCard && (
                    <button
                      onClick={() => onUpdate(card.id, { pinned: !card.pinned })}
                      className={`w-full px-3 py-2 rounded text-left text-sm flex items-center ${
                        card.pinned
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Pin className={`h-4 w-4 mr-2 ${card.pinned ? 'fill-current' : ''}`} />
                      {card.pinned ? 'Unpin from Top' : 'Pin to Top'}
                    </button>
                  )}
                  {canMoveCard && (
                    <button
                      onClick={handleOpenMoveModal}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-left text-sm flex items-center"
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Move
                    </button>
                  )}
                  <button
                    onClick={onCopy}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-left text-sm flex items-center"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                  {canDeleteCard && (
                    <>
                      <button
                        onClick={onArchive}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-left text-sm flex items-center"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </button>
                      <button
                        onClick={() => {
                          setTemplateName(card.title + ' Template');
                          setShowTemplateNameModal(true);
                        }}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-left text-sm flex items-center"
                      >
                        <LayoutTemplate className="h-4 w-4 mr-2" />
                        Save as Template
                      </button>
                      <button
                        onClick={onDelete}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded text-left text-sm flex items-center"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Move Modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowMoveModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Move Card</h3>
                <button
                  onClick={() => setShowMoveModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Board
                  </label>
                  {isLoadingBoards ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <select
                      value={selectedBoardId}
                      onChange={(e) => handleBoardSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a board...</option>
                      {availableBoards.map((board) => (
                        <option key={board.id} value={board.id}>
                          {board.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedBoardId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      List
                    </label>
                    {isLoadingLists ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    ) : availableLists.length === 0 ? (
                      <p className="text-sm text-gray-500 py-2">No lists in this board</p>
                    ) : (
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a list...</option>
                        {availableLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowMoveModal(false)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMoveCard}
                    disabled={!selectedListId || isMoving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isMoving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Move
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save as Template Modal */}
        {showTemplateNameModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setShowTemplateNameModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Save as Template</h3>
                <button
                  onClick={() => setShowTemplateNameModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <p className="text-xs text-gray-500">
                  This will save the card's description, labels, and checklists as a reusable template.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowTemplateNameModal(false)}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={!templateName.trim() || isSavingTemplate}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSavingTemplate && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
