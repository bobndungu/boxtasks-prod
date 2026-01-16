import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  arrayMove,
} from '@dnd-kit/sortable';
import {
  Star,
  Users,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  Archive,
  Search,
  EyeOff,
  LayoutTemplate,
  Filter,
  Settings,
  Zap,
  Layout,
  BarChart3,
  AlertTriangle,
  MessageCircle,
  User,
  Copy,
  ExternalLink,
  Clock,
  MoreHorizontal,
  GitBranch,
  Trash2,
} from 'lucide-react';
import { useBoardStore } from '../lib/stores/board';
import { fetchBoard, updateBoard, toggleBoardStar } from '../lib/api/boards';
import { fetchListsByBoard, createList, updateList, deleteList, archiveList, type BoardList } from '../lib/api/lists';
import { fetchCardsByBoard, createCard, updateCard, deleteCard, updateCardDepartment, updateCardClient, approveCard, rejectCard, clearApprovalStatus, restoreCard, fetchArchivedCardsByBoard, addGoogleDoc, removeGoogleDoc, type Card, type CardLabel } from '../lib/api/cards';
import { fetchDepartments, fetchClients, type TaxonomyTerm } from '../lib/api/taxonomies';
import { fetchActivitiesByBoard, getActivityDisplay, createActivity, type Activity } from '../lib/api/activities';
import { fetchTemplates, type CardTemplate } from '../lib/api/templates';
import { createChecklist, createChecklistItem } from '../lib/api/checklists';
import { createNotification } from '../lib/api/notifications';
import { fetchWorkspaceMembers, fetchAllUsers, type WorkspaceMember } from '../lib/api/workspaces';
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
import { fetchCustomFieldsByBoard, fetchCustomFieldValuesForCards, type CustomFieldDefinition, type CustomFieldValue } from '../lib/api/customFields';
import { ViewSelector, type ViewType } from '../components/ViewSelector';
import { ViewSettings, DEFAULT_VIEW_SETTINGS, type ViewSettingsData } from '../components/ViewSettings';
import { SavedViews, type SavedView } from '../components/SavedViews';
import CalendarView from '../components/CalendarView';
import TimelineView from '../components/TimelineView';
import TableView from '../components/TableView';
import DashboardView from '../components/DashboardView';
import { AutomationRules } from '../components/AutomationRules';
import { MindMapsPanel } from '../components/MindMapsPanel';
import { AdvancedFilters, DEFAULT_FILTER_STATE, matchesFilters, type FilterState } from '../components/AdvancedFilters';
import { BoardSkeleton } from '../components/BoardSkeleton';
import BoardSettingsModal from '../components/BoardSettingsModal';
import BoardMembersModal from '../components/BoardMembersModal';
import ChatPanel from '../components/ChatPanel';
import {
  LABEL_COLORS,
  SortableList,
  CardDragOverlay,
  ListDragOverlay,
  CardDetailModal,
  DEFAULT_FIELD_VISIBILITY,
  type CardFieldVisibility,
} from '../components/board';

export default function BoardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBoard, setCurrentBoard, updateBoard: updateBoardInStore } = useBoardStore();
  const { user: currentUser } = useAuthStore();

  // Role-based permissions
  const { canView, canCreate, canEdit, canDelete, canArchive, canMove, loading: permissionsLoading } = usePermissions(currentBoard?.workspaceId);

  // Check if user can view this board (after permissions are loaded)
  // Note: Board ownership is not tracked individually - workspace membership determines access
  const canViewBoard = permissionsLoading || !currentBoard ? true : canView('board', false);

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

  // Archived cards state
  const [showArchivedPanel, setShowArchivedPanel] = useState(false);
  const [archivedCards, setArchivedCards] = useState<Card[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

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
  // All users for member assignment dropdowns
  const [allUsers, setAllUsers] = useState<WorkspaceMember[]>([]);

  // Department and Client taxonomy state
  const [departments, setDepartments] = useState<TaxonomyTerm[]>([]);
  const [clients, setClients] = useState<TaxonomyTerm[]>([]);

  // Custom fields manager state
  const [showCustomFields, setShowCustomFields] = useState(false);

  // Automation rules state
  const [showAutomationRules, setShowAutomationRules] = useState(false);
  const [showMindMaps, setShowMindMaps] = useState(false);

  // Custom field data for cards display
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Map<string, CustomFieldValue[]>>(new Map());

  // Custom field filter alias for backwards compatibility
  const customFieldFilter = advancedFilters.customFields;

  // View switching state
  const [currentView, setCurrentView] = useState<ViewType>('kanban');
  const [viewSettings, setViewSettings] = useState<ViewSettingsData>(DEFAULT_VIEW_SETTINGS);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Field visibility settings (using imported type and defaults)
  const [fieldVisibility, setFieldVisibility] = useState<CardFieldVisibility>(() => {
    if (!id) return DEFAULT_FIELD_VISIBILITY;
    const stored = localStorage.getItem(`boxtasks_field_visibility_${id}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle missing properties
        return { ...DEFAULT_FIELD_VISIBILITY, ...parsed };
      } catch {
        return DEFAULT_FIELD_VISIBILITY;
      }
    }
    return DEFAULT_FIELD_VISIBILITY;
  });

  const [showFieldVisibilityMenu, setShowFieldVisibilityMenu] = useState(false);
  const [showBoardOptionsMenu, setShowBoardOptionsMenu] = useState(false);

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
      } else if (showArchivedPanel) {
        setShowArchivedPanel(false);
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
      const incomingCard = cardData as Card;
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        for (const [listId, cards] of newMap.entries()) {
          const index = cards.findIndex((c) => c.id === incomingCard.id);
          if (index !== -1) {
            const newCards = [...cards];
            const existingCard = newCards[index];
            // Merge incoming card data with existing card, preserving data
            // if not present in the incoming update
            newCards[index] = {
              ...existingCard,
              ...incomingCard,
              // Preserve approval data if incoming doesn't have it
              isApproved: incomingCard.isApproved ?? existingCard.isApproved,
              approvedBy: incomingCard.approvedBy ?? existingCard.approvedBy,
              approvedAt: incomingCard.approvedAt ?? existingCard.approvedAt,
              isRejected: incomingCard.isRejected ?? existingCard.isRejected,
              rejectedBy: incomingCard.rejectedBy ?? existingCard.rejectedBy,
              rejectedAt: incomingCard.rejectedAt ?? existingCard.rejectedAt,
              // Preserve estimate data if incoming doesn't have it
              estimate: incomingCard.estimate ?? existingCard.estimate,
              estimateType: incomingCard.estimateType ?? existingCard.estimateType,
              complexity: incomingCard.complexity ?? existingCard.complexity,
            };
            // Sort by position to handle reordering within the list
            newCards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            newMap.set(listId, newCards);
            break;
          }
        }
        return newMap;
      });
      // Update selected card if it's being viewed
      if (selectedCard?.id === incomingCard.id) {
        setSelectedCard((prev) => prev ? {
          ...prev,
          ...incomingCard,
          // Preserve approval data
          isApproved: incomingCard.isApproved ?? prev.isApproved,
          approvedBy: incomingCard.approvedBy ?? prev.approvedBy,
          approvedAt: incomingCard.approvedAt ?? prev.approvedAt,
          isRejected: incomingCard.isRejected ?? prev.isRejected,
          rejectedBy: incomingCard.rejectedBy ?? prev.rejectedBy,
          rejectedAt: incomingCard.rejectedAt ?? prev.rejectedAt,
          // Preserve estimate data (may not be in Mercure payload)
          estimate: incomingCard.estimate ?? prev.estimate,
          estimateType: incomingCard.estimateType ?? prev.estimateType,
          complexity: incomingCard.complexity ?? prev.complexity,
        } : null);
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
    onMemberAssigned: (data) => {
      // Update the card with new member assignment
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        for (const [listId, cards] of newMap.entries()) {
          const index = cards.findIndex((c) => c.id === data.cardId);
          if (index !== -1) {
            const newCards = [...cards];
            newCards[index] = {
              ...newCards[index],
              memberIds: data.memberIds,
              members: data.members,
            };
            newMap.set(listId, newCards);
            break;
          }
        }
        return newMap;
      });
      // Update selected card if it's being viewed
      if (selectedCard?.id === data.cardId) {
        setSelectedCard((prev) => prev ? {
          ...prev,
          memberIds: data.memberIds,
          members: data.members,
        } : null);
      }
    },
    onMemberUnassigned: (data) => {
      // Update the card with member removal
      setCardsByList((prev) => {
        const newMap = new Map(prev);
        for (const [listId, cards] of newMap.entries()) {
          const index = cards.findIndex((c) => c.id === data.cardId);
          if (index !== -1) {
            const newCards = [...cards];
            newCards[index] = {
              ...newCards[index],
              memberIds: data.memberIds,
              members: data.members,
            };
            newMap.set(listId, newCards);
            break;
          }
        }
        return newMap;
      });
      // Update selected card if it's being viewed
      if (selectedCard?.id === data.cardId) {
        setSelectedCard((prev) => prev ? {
          ...prev,
          memberIds: data.memberIds,
          members: data.members,
        } : null);
      }
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
      // Step 1: Fetch board first (needed for workspaceId)
      const board = await fetchBoard(id);
      setCurrentBoard(board);
      setBoardTitle(board.title);

      // Step 2: Fetch lists, custom fields, members, and taxonomy in parallel
      // This significantly reduces load time by not waiting for sequential requests
      const [
        boardLists,
        fieldDefsResult,
        membersResult,
        taxonomyResult,
      ] = await Promise.all([
        // Lists (required for cards)
        fetchListsByBoard(id),
        // Custom field definitions
        fetchCustomFieldsByBoard(id).catch((err) => {
          console.error('Failed to load custom fields:', err);
          return [] as Awaited<ReturnType<typeof fetchCustomFieldsByBoard>>;
        }),
        // Members and users (only if workspace exists)
        board.workspaceId
          ? Promise.all([
              fetchWorkspaceMembers(board.workspaceId),
              fetchAllUsers(),
            ]).catch((err) => {
              console.error('Failed to load members:', err);
              return [[], []] as [Awaited<ReturnType<typeof fetchWorkspaceMembers>>, Awaited<ReturnType<typeof fetchAllUsers>>];
            })
          : Promise.resolve([[], []] as [Awaited<ReturnType<typeof fetchWorkspaceMembers>>, Awaited<ReturnType<typeof fetchAllUsers>>]),
        // Taxonomy terms
        Promise.all([
          fetchDepartments(),
          fetchClients(),
        ]).catch((err) => {
          console.error('Failed to load taxonomy terms:', err);
          return [[], []] as [Awaited<ReturnType<typeof fetchDepartments>>, Awaited<ReturnType<typeof fetchClients>>];
        }),
      ]);

      // Apply lists
      setLists(boardLists);

      // Apply custom field definitions
      setCustomFieldDefs(fieldDefsResult);

      // Apply members (filter out system users)
      const [members, users] = membersResult;
      const systemUserNames = ['boxraft admin', 'n8n_api', 'n8n api'];
      const filterSystemUsers = (userList: typeof members) =>
        userList.filter(u => !systemUserNames.includes(u.displayName.toLowerCase()));
      setWorkspaceMembers(filterSystemUsers(members));
      setAllUsers(filterSystemUsers(users));

      // Apply taxonomy terms
      const [depts, clnts] = taxonomyResult;
      setDepartments(depts);
      setClients(clnts);

      // Step 3: Fetch cards (needs list IDs from step 2)
      const listIds = boardLists.map(list => list.id);
      const cardsMap = await fetchCardsByBoard(id, listIds);
      setCardsByList(cardsMap);

      // Step 4: Fetch custom field values (needs card IDs from step 3)
      if (fieldDefsResult.length > 0) {
        const allCards = Array.from(cardsMap.values()).flat();
        const cardIds = allCards.map(card => card.id);
        try {
          const valuesMap = await fetchCustomFieldValuesForCards(cardIds);
          setCustomFieldValues(valuesMap);
        } catch (cfvErr) {
          console.error('Failed to load custom field values:', cfvErr);
        }
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
      watchers: [],
      memberIds: [],
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      commentCount: 0,
      attachmentCount: 0,
      checklistCompleted: 0,
      checklistTotal: 0,
      isApproved: false,
      isRejected: false,
      googleDocs: [],
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
        // Show activity notification for card creation
        const listName = lists.find(l => l.id === listId)?.title || 'list';
        toast.info(`Card "${newCard.title}" added to "${listName}"`, 3000);
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
      const apiResponse = await updateCard(cardId, updates);
      // Merge the updates we sent with the API response, because the API may not
      // return all fields (especially estimate fields which aren't in the default response)
      const updated = { ...apiResponse, ...updates };
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
      const listName = lists.find(l => l.id === card.listId)?.title || 'list';
      await deleteCard(card.id);
      const newCardsMap = new Map(cardsByList);
      const listCards = newCardsMap.get(card.listId) || [];
      newCardsMap.set(
        card.listId,
        listCards.filter((c) => c.id !== card.id)
      );
      setCardsByList(newCardsMap);
      setSelectedCard(null);
      // Show activity notification for card deletion
      toast.info(`Card "${card.title}" deleted from "${listName}"`, 3000);
    } catch {
      setError('Failed to delete card');
    }
  };

  const handleArchiveCard = async (card: Card) => {
    try {
      const listName = lists.find(l => l.id === card.listId)?.title || 'list';
      await updateCard(card.id, { archived: true });
      const newCardsMap = new Map(cardsByList);
      const listCards = newCardsMap.get(card.listId) || [];
      newCardsMap.set(
        card.listId,
        listCards.filter((c) => c.id !== card.id)
      );
      setCardsByList(newCardsMap);
      setSelectedCard(null);

      // Create activity record for archiving
      try {
        await createActivity({
          type: 'card_archived',
          description: `${currentUser?.displayName || 'User'} archived "${card.title}" from ${listName}`,
          cardId: card.id,
          boardId: id || undefined,
        });
      } catch (activityErr) {
        console.error('Failed to create archive activity:', activityErr);
      }

      // Send notifications to card members and watchers (excluding current user)
      const usersToNotify = new Set<string>();
      // Add assigned members
      if (card.memberIds) {
        card.memberIds.forEach(memberId => usersToNotify.add(memberId));
      }
      // Add watchers
      if (card.watcherIds) {
        card.watcherIds.forEach(watcherId => usersToNotify.add(watcherId));
      }
      // Remove current user from notification list
      if (currentUser?.id) {
        usersToNotify.delete(currentUser.id);
      }

      // Send notifications
      for (const userId of usersToNotify) {
        try {
          await createNotification({
            userId,
            type: 'card_archived',
            message: `${currentUser?.displayName || 'Someone'} archived "${card.title}"`,
            cardId: card.id,
            actorId: currentUser?.id,
          });
        } catch (notifyErr) {
          console.error('Failed to send archive notification:', notifyErr);
        }
      }

      // Show activity notification for card archiving
      toast.info(`Card "${card.title}" archived from "${listName}"`, 3000);

      // Add to archived cards list if panel is open
      if (showArchivedPanel) {
        setArchivedCards(prev => [{ ...card, archived: true }, ...prev]);
      }
    } catch {
      setError('Failed to archive card');
    }
  };

  // Load archived cards for the board
  const loadArchivedCards = useCallback(async () => {
    if (!id || lists.length === 0) return;

    setLoadingArchived(true);
    try {
      const listIds = lists.map(l => l.id);
      const archived = await fetchArchivedCardsByBoard(id, listIds);
      setArchivedCards(archived);
    } catch (err) {
      console.error('Failed to load archived cards:', err);
      toast.error('Failed to load archived cards');
    } finally {
      setLoadingArchived(false);
    }
  }, [id, lists]);

  // Load archived cards when panel is opened
  useEffect(() => {
    if (showArchivedPanel && archivedCards.length === 0) {
      loadArchivedCards();
    }
  }, [showArchivedPanel, loadArchivedCards, archivedCards.length]);

  // Handle restoring an archived card
  const handleRestoreCard = async (card: Card) => {
    try {
      const listName = lists.find(l => l.id === card.listId)?.title || 'list';

      // Restore the card (set archived = false)
      const restoredCard = await restoreCard(card.id);

      // Remove from archived cards list
      setArchivedCards(prev => prev.filter(c => c.id !== card.id));

      // Add to the appropriate list in cardsByList
      const newCardsMap = new Map(cardsByList);
      const listCards = newCardsMap.get(card.listId) || [];
      // Add to the top of the list
      newCardsMap.set(card.listId, [{ ...restoredCard, archived: false }, ...listCards]);
      setCardsByList(newCardsMap);

      // Create activity record for restoring
      try {
        await createActivity({
          type: 'card_restored',
          description: `${currentUser?.displayName || 'User'} restored "${card.title}" to ${listName}`,
          cardId: card.id,
          boardId: id || undefined,
        });
      } catch (activityErr) {
        console.error('Failed to create restore activity:', activityErr);
      }

      // Show success message
      toast.success(`Card "${card.title}" restored to "${listName}"`);
    } catch {
      setError('Failed to restore card');
      toast.error('Failed to restore card');
    }
  };

  // Handle permanently deleting an archived card
  const handleDeleteArchivedCard = async (card: Card) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${card.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteCard(card.id);

      // Remove from archived cards list
      setArchivedCards(prev => prev.filter(c => c.id !== card.id));

      // Create activity record
      try {
        await createActivity({
          type: 'card_deleted',
          description: `${currentUser?.displayName || 'User'} permanently deleted "${card.title}"`,
          boardId: id || undefined,
        });
      } catch (activityErr) {
        console.error('Failed to create delete activity:', activityErr);
      }

      toast.success(`Card "${card.title}" permanently deleted`);
    } catch {
      toast.error('Failed to delete card');
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

        // Show activity notification for card movement
        const movedCard = newCardOrder.find(c => c.id === activeIdStr);
        const fromList = lists.find(l => l.id === sourceListId);
        const toList = lists.find(l => l.id === currentListId);
        if (movedCard && fromList && toList) {
          toast.info(`Card "${movedCard.title}" moved from "${fromList.title}" to "${toList.title}"`, 3000);
        }
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

  // Access denied if user cannot view the board
  if (!canViewBoard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don&apos;t have permission to view this board. Contact the workspace admin to request access.
          </p>
          <Link
            to="/workspaces"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workspaces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: currentBoard?.background || '#0079BF' }}
    >
      {/* Board Header - Two Row Layout */}
      <header className="bg-black/30 backdrop-blur-sm relative z-20">
        {/* Row 1: Primary Navigation */}
        <div className="px-4 py-2 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* BoxTasks Logo */}
              <Link to="/dashboard" className="flex items-center space-x-2 text-white hover:text-white/90">
                <Layout className="h-6 w-6" />
                <span className="font-bold text-lg hidden sm:inline">BoxTasks</span>
              </Link>

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

            {/* Connection Status & Active Users on Row 1 */}
            <div className="flex items-center space-x-2">
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
            </div>
          </div>
        </div>

        {/* Row 2: Board Actions */}
        <div className="px-4 py-1.5">
          <div className="flex items-center justify-between">
            {/* Left: Search & Filters */}
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
              {/* Advanced Filters */}
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
            </div>

            {/* Right: Actions & Settings */}
            <div className="flex items-center space-x-2">
              {/* Share Dropdown */}
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
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowShareDropdown(false)} />
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
                  </>
                )}
              </div>

              {/* Activity Button */}
              <button
                onClick={toggleActivitySidebar}
                className={`px-3 py-1.5 rounded flex items-center text-sm ${
                  showActivitySidebar ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Activity
              </button>

              {/* Archived Cards Button */}
              <button
                onClick={() => setShowArchivedPanel(!showArchivedPanel)}
                className={`px-3 py-1.5 rounded flex items-center text-sm ${
                  showArchivedPanel ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archived
              </button>

              {/* Divider */}
              <div className="h-6 w-px bg-white/20" />

              {/* View Controls */}
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

              {/* Divider */}
              <div className="h-6 w-px bg-white/20" />

              {/* Board Options Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowBoardOptionsMenu(!showBoardOptionsMenu)}
                  className={`px-3 py-1.5 rounded flex items-center text-sm ${
                    showBoardOptionsMenu ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4 mr-2" />
                  Options
                </button>
                {showBoardOptionsMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowBoardOptionsMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-56">
                      <button
                        onClick={() => {
                          setShowCustomFields(true);
                          setShowBoardOptionsMenu(false);
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Settings className="h-4 w-4 mr-3 text-gray-500" />
                        Custom Fields
                      </button>
                      <button
                        onClick={() => {
                          setShowAutomationRules(true);
                          setShowBoardOptionsMenu(false);
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Zap className="h-4 w-4 mr-3 text-gray-500" />
                        Automation Rules
                      </button>
                      <button
                        onClick={() => {
                          setShowMindMaps(true);
                          setShowBoardOptionsMenu(false);
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <GitBranch className="h-4 w-4 mr-3 text-gray-500" />
                        Mind Maps
                      </button>
                      <Link
                        to={`/board/${id}/reports`}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowBoardOptionsMenu(false)}
                      >
                        <BarChart3 className="h-4 w-4 mr-3 text-gray-500" />
                        Reports
                      </Link>
                      <div className="border-t border-gray-200 my-1" />
                      <button
                        onClick={() => {
                          setShowFieldVisibilityMenu(true);
                          setShowBoardOptionsMenu(false);
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <EyeOff className="h-4 w-4 mr-3 text-gray-500" />
                        Show/Hide Fields
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Field Visibility Menu (Separate Modal) */}
        {showFieldVisibilityMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowFieldVisibilityMenu(false)} />
            <div className="fixed right-4 top-28 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 w-56">
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
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.checklists}
                    onChange={(e) => setFieldVisibility((prev) => ({ ...prev, checklists: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Checklist Count</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.comments}
                    onChange={(e) => setFieldVisibility((prev) => ({ ...prev, comments: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Comment Count</span>
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
                  canArchiveCard={(authorId: string) => canArchive('card', authorId === currentUser?.id)}
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

      {/* Archived Cards Panel */}
      {showArchivedPanel && (
        <div className="w-80 bg-white shadow-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Archived Cards</h3>
            <button
              onClick={() => setShowArchivedPanel(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loadingArchived ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : archivedCards.length === 0 ? (
              <div className="text-center py-8">
                <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No archived cards</p>
                <p className="text-gray-400 text-xs mt-1">Archived cards will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedCards.map((card) => {
                  const listName = lists.find(l => l.id === card.listId)?.title || 'Unknown list';
                  return (
                    <div
                      key={card.id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <h4 className="font-medium text-gray-800 text-sm">{card.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">From: {listName}</p>
                      {card.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{card.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleRestoreCard(card)}
                          className="flex-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors flex items-center justify-center"
                        >
                          <Archive className="h-3 w-3 mr-1 rotate-180" />
                          Restore
                        </button>
                        {canDelete('card', card.authorId === currentUser?.id) && (
                          <button
                            onClick={() => handleDeleteArchivedCard(card)}
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium rounded transition-colors flex items-center justify-center"
                            title="Delete permanently"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 border-t">
            <button
              onClick={loadArchivedCards}
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
          allUsers={allUsers}
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
          canArchiveCard={canArchive('card', selectedCard.authorId === currentUser?.id)}
          canMoveCard={canMove('card', selectedCard.authorId === currentUser?.id)}
          onApprove={async (cardId) => {
            if (!currentUser) return;
            const updatedCard = await approveCard(cardId, currentUser.id);
            setCardsByList((prev) => {
              const newMap = new Map(prev);
              const listCards = newMap.get(updatedCard.listId) || [];
              const updatedCards = listCards.map((c) =>
                c.id === cardId ? { ...c, isApproved: true, isRejected: false, approvedBy: { id: currentUser.id, name: currentUser.displayName }, approvedAt: new Date().toISOString(), rejectedBy: undefined, rejectedAt: undefined } : c
              );
              newMap.set(updatedCard.listId, updatedCards);
              return newMap;
            });
            setSelectedCard((prev) => prev ? { ...prev, isApproved: true, isRejected: false, approvedBy: { id: currentUser.id, name: currentUser.displayName }, approvedAt: new Date().toISOString(), rejectedBy: undefined, rejectedAt: undefined } : null);
          }}
          onReject={async (cardId) => {
            if (!currentUser) return;
            const updatedCard = await rejectCard(cardId, currentUser.id);
            setCardsByList((prev) => {
              const newMap = new Map(prev);
              const listCards = newMap.get(updatedCard.listId) || [];
              const updatedCards = listCards.map((c) =>
                c.id === cardId ? { ...c, isApproved: false, isRejected: true, approvedBy: undefined, approvedAt: undefined, rejectedBy: { id: currentUser.id, name: currentUser.displayName }, rejectedAt: new Date().toISOString() } : c
              );
              newMap.set(updatedCard.listId, updatedCards);
              return newMap;
            });
            setSelectedCard((prev) => prev ? { ...prev, isApproved: false, isRejected: true, approvedBy: undefined, approvedAt: undefined, rejectedBy: { id: currentUser.id, name: currentUser.displayName }, rejectedAt: new Date().toISOString() } : null);
          }}
          onClearStatus={async (cardId) => {
            const updatedCard = await clearApprovalStatus(cardId);
            setCardsByList((prev) => {
              const newMap = new Map(prev);
              const listCards = newMap.get(updatedCard.listId) || [];
              const updatedCards = listCards.map((c) =>
                c.id === cardId ? { ...c, isApproved: false, isRejected: false, approvedBy: undefined, approvedAt: undefined, rejectedBy: undefined, rejectedAt: undefined } : c
              );
              newMap.set(updatedCard.listId, updatedCards);
              return newMap;
            });
            setSelectedCard((prev) => prev ? { ...prev, isApproved: false, isRejected: false, approvedBy: undefined, approvedAt: undefined, rejectedBy: undefined, rejectedAt: undefined } : null);
          }}
          onGoogleDocAdd={async (cardId, url, title) => {
            const updatedCard = await addGoogleDoc(cardId, url, title);
            setCardsByList((prev) => {
              const newMap = new Map(prev);
              const listCards = newMap.get(updatedCard.listId) || [];
              const updatedCards = listCards.map((c) =>
                c.id === cardId ? { ...c, googleDocs: updatedCard.googleDocs } : c
              );
              newMap.set(updatedCard.listId, updatedCards);
              return newMap;
            });
            setSelectedCard((prev) => prev ? { ...prev, googleDocs: updatedCard.googleDocs } : null);
          }}
          onGoogleDocRemove={async (cardId, url) => {
            const updatedCard = await removeGoogleDoc(cardId, url);
            setCardsByList((prev) => {
              const newMap = new Map(prev);
              const listCards = newMap.get(updatedCard.listId) || [];
              const updatedCards = listCards.map((c) =>
                c.id === cardId ? { ...c, googleDocs: updatedCard.googleDocs } : c
              );
              newMap.set(updatedCard.listId, updatedCards);
              return newMap;
            });
            setSelectedCard((prev) => prev ? { ...prev, googleDocs: updatedCard.googleDocs } : null);
          }}
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

      {/* Mind Maps Panel */}
      {showMindMaps && id && (
        <MindMapsPanel
          boardId={id}
          onClose={() => setShowMindMaps(false)}
        />
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
