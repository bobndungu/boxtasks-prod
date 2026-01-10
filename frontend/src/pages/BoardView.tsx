import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
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
} from 'lucide-react';
import { useBoardStore } from '../lib/stores/board';
import { fetchBoard, updateBoard, toggleBoardStar, fetchAllBoards, type Board } from '../lib/api/boards';
import { fetchListsByBoard, createList, updateList, deleteList, archiveList, type BoardList } from '../lib/api/lists';
import { fetchCardsByList, createCard, updateCard, deleteCard, uploadCardCover, removeCardCover, watchCard, unwatchCard, assignMember, unassignMember, type Card, type CardLabel, type CardMember } from '../lib/api/cards';
import { fetchCommentsByCard, createComment, updateComment, deleteComment, toggleReaction, type CardComment, type ReactionType } from '../lib/api/comments';
import { fetchAttachmentsByCard, createAttachment, deleteAttachment, formatFileSize, type CardAttachment } from '../lib/api/attachments';
import { fetchChecklistsByCard, createChecklist, deleteChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem, type Checklist } from '../lib/api/checklists';
import { fetchActivitiesByCard, fetchActivitiesByBoard, getActivityDisplay, type Activity } from '../lib/api/activities';
import { createTemplate, fetchTemplates, type CardTemplate, type ChecklistTemplate } from '../lib/api/templates';
import { createNotification } from '../lib/api/notifications';
import { fetchWorkspaceMembers, type WorkspaceMember } from '../lib/api/workspaces';
import { useKeyboardShortcuts } from '../lib/hooks/useKeyboardShortcuts';
import { useBoardUpdates } from '../lib/hooks/useMercure';
import { usePresence } from '../lib/hooks/usePresence';
import { useOptimistic } from '../lib/hooks/useOptimistic';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { ActiveUsers } from '../components/ActiveUsers';
import { useAuthStore } from '../lib/stores/auth';
import { toast } from '../lib/stores/toast';
import { CustomFieldsManager } from '../components/CustomFieldsManager';
import { fetchCustomFieldsByBoard, fetchCardCustomFieldValues, setCardCustomFieldValue, type CustomFieldDefinition, type CustomFieldValue } from '../lib/api/customFields';
import { ViewSelector, type ViewType } from '../components/ViewSelector';
import { ViewSettings, DEFAULT_VIEW_SETTINGS, type ViewSettingsData } from '../components/ViewSettings';
import CalendarView from '../components/CalendarView';
import TimelineView from '../components/TimelineView';
import TableView from '../components/TableView';
import DashboardView from '../components/DashboardView';

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
  const { currentBoard, setCurrentBoard } = useBoardStore();
  const { user: currentUser } = useAuthStore();

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

  // Board activity sidebar state
  const [showActivitySidebar, setShowActivitySidebar] = useState(false);
  const [boardActivities, setBoardActivities] = useState<Activity[]>([]);

  // List collapse state (stored locally, not persisted)
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());
  const [isLoadingBoardActivities, setIsLoadingBoardActivities] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Label filter state
  const [labelFilter, setLabelFilter] = useState<CardLabel[]>([]);
  const [showLabelFilter, setShowLabelFilter] = useState(false);

  // Member filter state
  const [memberFilter, setMemberFilter] = useState<string[]>([]);
  const [showMemberFilter, setShowMemberFilter] = useState(false);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templatePickerListId, setTemplatePickerListId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);

  // Workspace members for @mentions
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  // Custom fields manager state
  const [showCustomFields, setShowCustomFields] = useState(false);

  // Custom field data for cards display
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Map<string, CustomFieldValue[]>>(new Map());

  // Custom field filter state
  interface CustomFieldFilterItem {
    definitionId: string;
    value: string;
  }
  const [customFieldFilter, setCustomFieldFilter] = useState<CustomFieldFilterItem[]>([]);
  const [showCustomFieldFilter, setShowCustomFieldFilter] = useState(false);

  // View switching state
  const [currentView, setCurrentView] = useState<ViewType>('kanban');
  const [viewSettings, setViewSettings] = useState<ViewSettingsData>(DEFAULT_VIEW_SETTINGS);

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
        if (!prev.some((l) => l.id === list.id)) {
          return [...prev, list];
        }
        return prev;
      });
      setCardsByList((prev) => {
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

  // Filter cards based on search query, label filter, member filter, and custom field filter
  const filteredCardsByList = useMemo(() => {
    const hasSearchQuery = searchQuery.trim().length > 0;
    const hasLabelFilter = labelFilter.length > 0;
    const hasMemberFilter = memberFilter.length > 0;
    const hasCustomFieldFilter = customFieldFilter.length > 0;

    if (!hasSearchQuery && !hasLabelFilter && !hasMemberFilter && !hasCustomFieldFilter) return cardsByList;

    const query = searchQuery.toLowerCase();
    const filtered = new Map<string, Card[]>();

    for (const [listId, cards] of cardsByList.entries()) {
      const matchingCards = cards.filter((card) => {
        // Check search query
        const matchesSearch = !hasSearchQuery ||
          card.title.toLowerCase().includes(query) ||
          (card.description && card.description.toLowerCase().includes(query));

        // Check label filter (card must have at least one of the selected labels)
        const matchesLabel = !hasLabelFilter ||
          labelFilter.some((label) => card.labels.includes(label));

        // Check member filter (card must have at least one of the selected members)
        const matchesMember = !hasMemberFilter ||
          memberFilter.some((memberId) => card.memberIds?.includes(memberId));

        // Check custom field filter (all filter conditions must match)
        let matchesCustomField = true;
        if (hasCustomFieldFilter) {
          const cardCfValues = customFieldValues.get(card.id) || [];
          matchesCustomField = customFieldFilter.every((filterItem) => {
            const cardValue = cardCfValues.find((v) => v.definitionId === filterItem.definitionId);
            if (!cardValue) return false;
            // For checkbox fields, compare boolean string
            const fieldDef = customFieldDefs.find((d) => d.id === filterItem.definitionId);
            if (fieldDef?.type === 'checkbox') {
              return cardValue.value === filterItem.value;
            }
            // For other fields, case-insensitive contains match
            return cardValue.value.toLowerCase().includes(filterItem.value.toLowerCase());
          });
        }

        return matchesSearch && matchesLabel && matchesMember && matchesCustomField;
      });
      filtered.set(listId, matchingCards);
    }

    return filtered;
  }, [cardsByList, searchQuery, labelFilter, memberFilter, customFieldFilter, customFieldValues, customFieldDefs]);

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

    // Create temporary optimistic card
    const tempCard: Card = {
      id: tempId,
      title: titleToCreate,
      listId,
      position: listCards.length,
      labels: [],
      archived: false,
      completed: false,
      watcherIds: [],
      memberIds: [],
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Clear form immediately for better UX
    setNewCardTitle('');
    setAddingCardToList(null);

    // Execute with optimistic update
    await cardOptimistic.execute({
      currentState: cardsByList,
      optimisticUpdate: (current) => {
        const newMap = new Map(current);
        const cards = newMap.get(listId) || [];
        newMap.set(listId, [...cards, tempCard]);
        return newMap;
      },
      apiCall: () => createCard({
        title: titleToCreate,
        listId,
        position: listCards.length,
      }),
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

      // Create the card with template data
      const newCard = await createCard({
        title: template.title,
        listId: templatePickerListId,
        description: template.description,
        labels: template.labels.length > 0 ? template.labels : undefined,
        position: listCards.length,
      });

      // Create checklists from template
      for (const checklistTemplate of template.checklists) {
        const checklist = await createChecklist(newCard.id, checklistTemplate.title);
        // Create checklist items
        for (let i = 0; i < checklistTemplate.items.length; i++) {
          await createChecklistItem(checklist.id, checklistTemplate.items[i].title, i);
        }
      }

      // Update the cards map
      const newCardsMap = new Map(cardsByList);
      newCardsMap.set(templatePickerListId, [...listCards, newCard]);
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
      const newCard = await createCard({
        title: `${card.title} (copy)`,
        listId: card.listId,
        description: card.description,
        position: listCards.length,
        labels: card.labels,
      });
      const newCardsMap = new Map(cardsByList);
      newCardsMap.set(card.listId, [...listCards, newCard]);
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
    } else {
      setActiveType('card');
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

      // Find the index to insert at
      const overIndex = destCards.findIndex((c) => c.id === overIdStr);
      if (overIndex === -1) {
        // Dropping on the list itself (empty or at end)
        destCards.push({ ...movedCard, listId: overListId });
      } else {
        destCards.splice(overIndex, 0, { ...movedCard, listId: overListId });
      }

      newMap.set(activeListId, sourceCards);
      newMap.set(overListId, destCards);

      return newMap;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveType(null);

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

    // Handle card reordering within the same list
    const listId = findListContainingCard(activeIdStr);
    if (!listId) return;

    const cards = cardsByList.get(listId) || [];
    const oldIndex = cards.findIndex((c) => c.id === activeIdStr);
    const newIndex = cards.findIndex((c) => c.id === overIdStr);

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const newCards = arrayMove(cards, oldIndex, newIndex);
      const newCardsMap = new Map(cardsByList);
      newCardsMap.set(listId, newCards);
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

    // Handle card moved to different list
    const card = getCard(activeIdStr);
    if (card) {
      const newListId = findListContainingCard(activeIdStr);
      if (newListId && newListId !== card.listId) {
        const newCards = cardsByList.get(newListId) || [];
        const newPosition = newCards.findIndex((c) => c.id === activeIdStr);

        try {
          await updateCard(activeIdStr, {
            listId: newListId,
            position: newPosition >= 0 ? newPosition : newCards.length,
          });
        } catch {
          setError('Failed to move card');
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
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: currentBoard?.background || '#0079BF' }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: currentBoard?.background || '#0079BF' }}
    >
      {/* Board Header */}
      <header className="bg-black/30 backdrop-blur-sm">
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
              {/* Label Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowLabelFilter(!showLabelFilter)}
                  className={`px-3 py-1.5 rounded flex items-center text-sm ${
                    labelFilter.length > 0 ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                  {labelFilter.length > 0 && (
                    <span className="ml-1 bg-white/30 rounded-full px-1.5 text-xs">
                      {labelFilter.length}
                    </span>
                  )}
                </button>
                {showLabelFilter && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                    <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
                      Filter by Label
                    </div>
                    {(['green', 'yellow', 'orange', 'red', 'purple', 'blue'] as CardLabel[]).map((label) => (
                      <button
                        key={label}
                        onClick={() => {
                          if (labelFilter.includes(label)) {
                            setLabelFilter(labelFilter.filter((l) => l !== label));
                          } else {
                            setLabelFilter([...labelFilter, label]);
                          }
                        }}
                        className="w-full px-3 py-1.5 flex items-center hover:bg-gray-100"
                      >
                        <span
                          className={`w-8 h-5 rounded mr-3 ${
                            label === 'green' ? 'bg-green-500' :
                            label === 'yellow' ? 'bg-yellow-500' :
                            label === 'orange' ? 'bg-orange-500' :
                            label === 'red' ? 'bg-red-500' :
                            label === 'purple' ? 'bg-purple-500' :
                            'bg-blue-500'
                          }`}
                        />
                        <span className="capitalize text-sm text-gray-700">{label}</span>
                        {labelFilter.includes(label) && (
                          <Check className="h-4 w-4 ml-auto text-blue-600" />
                        )}
                      </button>
                    ))}
                    {labelFilter.length > 0 && (
                      <>
                        <div className="border-t my-1" />
                        <button
                          onClick={() => {
                            setLabelFilter([]);
                            setShowLabelFilter(false);
                          }}
                          className="w-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 text-left"
                        >
                          Clear filter
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
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
              {/* Member Filter */}
              <div className="relative">
                <button
                  onClick={() => setShowMemberFilter(!showMemberFilter)}
                  className={`px-3 py-1.5 rounded flex items-center text-sm ${
                    memberFilter.length > 0 ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Members
                  {memberFilter.length > 0 && (
                    <span className="ml-1 bg-white/30 rounded-full px-1.5 text-xs">
                      {memberFilter.length}
                    </span>
                  )}
                </button>
                {showMemberFilter && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-lg shadow-lg py-2 z-50">
                    <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
                      Filter by Member
                    </div>
                    {currentUser && (
                      <button
                        onClick={() => {
                          if (memberFilter.includes(currentUser.id)) {
                            setMemberFilter(memberFilter.filter((id) => id !== currentUser.id));
                          } else {
                            setMemberFilter([...memberFilter, currentUser.id]);
                          }
                        }}
                        className="w-full px-3 py-1.5 flex items-center hover:bg-gray-100"
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium mr-3">
                          {(currentUser.displayName || currentUser.username).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-700">
                          {currentUser.displayName || currentUser.username} (me)
                        </span>
                        {memberFilter.includes(currentUser.id) && (
                          <Check className="h-4 w-4 ml-auto text-blue-600" />
                        )}
                      </button>
                    )}
                    {memberFilter.length > 0 && (
                      <>
                        <div className="border-t my-1" />
                        <button
                          onClick={() => {
                            setMemberFilter([]);
                            setShowMemberFilter(false);
                          }}
                          className="w-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 text-left"
                        >
                          Clear filter
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Custom Field Filter */}
              {customFieldDefs.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowCustomFieldFilter(!showCustomFieldFilter)}
                    className={`px-3 py-1.5 rounded flex items-center text-sm ${
                      customFieldFilter.length > 0 ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Custom
                    {customFieldFilter.length > 0 && (
                      <span className="ml-1 bg-white/30 rounded-full px-1.5 text-xs">
                        {customFieldFilter.length}
                      </span>
                    )}
                  </button>
                  {showCustomFieldFilter && (
                    <div className="absolute top-full right-0 mt-1 w-72 bg-white rounded-lg shadow-lg py-2 z-50">
                      <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
                        Filter by Custom Fields
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {customFieldDefs.map((fieldDef) => {
                          const existingFilter = customFieldFilter.find((f) => f.definitionId === fieldDef.id);
                          return (
                            <div key={fieldDef.id} className="px-3 py-2 border-b border-gray-100 last:border-b-0">
                              <div className="text-sm font-medium text-gray-700 mb-1">{fieldDef.title}</div>
                              {fieldDef.type === 'dropdown' ? (
                                <select
                                  value={existingFilter?.value || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      setCustomFieldFilter(customFieldFilter.filter((f) => f.definitionId !== fieldDef.id));
                                    } else {
                                      const newFilter = customFieldFilter.filter((f) => f.definitionId !== fieldDef.id);
                                      newFilter.push({ definitionId: fieldDef.id, value });
                                      setCustomFieldFilter(newFilter);
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">All</option>
                                  {fieldDef.options.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : fieldDef.type === 'checkbox' ? (
                                <select
                                  value={existingFilter?.value || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      setCustomFieldFilter(customFieldFilter.filter((f) => f.definitionId !== fieldDef.id));
                                    } else {
                                      const newFilter = customFieldFilter.filter((f) => f.definitionId !== fieldDef.id);
                                      newFilter.push({ definitionId: fieldDef.id, value });
                                      setCustomFieldFilter(newFilter);
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">All</option>
                                  <option value="true">Yes</option>
                                  <option value="false">No</option>
                                </select>
                              ) : (
                                <input
                                  type={fieldDef.type === 'number' ? 'number' : fieldDef.type === 'date' ? 'date' : 'text'}
                                  value={existingFilter?.value || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      setCustomFieldFilter(customFieldFilter.filter((f) => f.definitionId !== fieldDef.id));
                                    } else {
                                      const newFilter = customFieldFilter.filter((f) => f.definitionId !== fieldDef.id);
                                      newFilter.push({ definitionId: fieldDef.id, value });
                                      setCustomFieldFilter(newFilter);
                                    }
                                  }}
                                  placeholder={`Filter by ${fieldDef.title.toLowerCase()}...`}
                                  className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {customFieldFilter.length > 0 && (
                        <>
                          <div className="border-t my-1" />
                          <button
                            onClick={() => {
                              setCustomFieldFilter([]);
                              setShowCustomFieldFilter(false);
                            }}
                            className="w-full px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 text-left"
                          >
                            Clear all filters
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button className="text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded flex items-center text-sm">
                <Users className="h-4 w-4 mr-2" />
                Share
              </button>
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
              <button
                onClick={() => setShowCustomFields(true)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded flex items-center gap-1"
                title="Custom Fields"
              >
                <Settings className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">Fields</span>
              </button>
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

      {/* Label Filter Banner */}
      {labelFilter.length > 0 && (
        <div className="bg-blue-100 text-blue-800 px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            <span>Filtering by labels: </span>
            <div className="flex items-center gap-1 ml-2">
              {labelFilter.map((label) => (
                <span
                  key={label}
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
            </div>
            <span className="ml-2">
              — {Array.from(filteredCardsByList.values()).reduce((sum, cards) => sum + cards.length, 0)} cards
            </span>
          </div>
          <button
            onClick={() => setLabelFilter([])}
            className="text-blue-800 hover:text-blue-900 underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Custom Field Filter Banner */}
      {customFieldFilter.length > 0 && (
        <div className="bg-purple-100 text-purple-800 px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center flex-wrap gap-2">
            <Settings className="h-4 w-4 mr-1" />
            <span>Filtering by custom fields: </span>
            {customFieldFilter.map((filter) => {
              const fieldDef = customFieldDefs.find((d) => d.id === filter.definitionId);
              if (!fieldDef) return null;
              let displayValue = filter.value;
              if (fieldDef.type === 'checkbox') {
                displayValue = filter.value === 'true' ? 'Yes' : 'No';
              }
              return (
                <span
                  key={filter.definitionId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-200 rounded text-xs"
                >
                  <strong>{fieldDef.title}:</strong> {displayValue}
                  <button
                    onClick={() => setCustomFieldFilter(customFieldFilter.filter((f) => f.definitionId !== filter.definitionId))}
                    className="text-purple-600 hover:text-purple-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            <span className="ml-2">
              — {Array.from(filteredCardsByList.values()).reduce((sum, cards) => sum + cards.length, 0)} cards
            </span>
          </div>
          <button
            onClick={() => setCustomFieldFilter([])}
            className="text-purple-800 hover:text-purple-900 underline"
          >
            Clear filter
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
              ) : (
                <button
                  onClick={() => setAddingListId('new')}
                  className="w-full bg-white/20 hover:bg-white/30 text-white rounded-xl px-4 py-3 text-left flex items-center font-medium transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add another list
                </button>
              )}
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
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWipSettings, setShowWipSettings] = useState(false);
  const [wipLimitValue, setWipLimitValue] = useState(list.wipLimit?.toString() || '0');

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

      {/* Cards (collapsible) */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
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
              />
            ))}
          </SortableContext>

          {/* Add Card Form */}
          {addingCardToList === list.id ? (
            <div className="bg-white rounded-lg p-2 shadow-sm">
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
          ) : (
            <div className="flex items-center gap-1">
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
          )}
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
function SortableCard({
  card,
  onClick,
  onQuickComplete,
  onQuickArchive,
  onQuickEdit,
  customFieldDefs,
  cardCustomFieldValues,
}: {
  card: Card;
  onClick: () => void;
  onQuickComplete: (e: React.MouseEvent) => void;
  onQuickArchive: (e: React.MouseEvent) => void;
  onQuickEdit: (e: React.MouseEvent) => void;
  customFieldDefs: CustomFieldDefinition[];
  cardCustomFieldValues: CustomFieldValue[];
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
      }`}
      onMouseEnter={() => setShowQuickActions(true)}
      onMouseLeave={() => setShowQuickActions(false)}
    >
      {/* Quick Actions - appear on hover */}
      {showQuickActions && !isDragging && (
        <div className="absolute -top-2 right-1 flex items-center gap-1 z-10">
          <button
            onClick={onQuickComplete}
            className={`p-1.5 rounded shadow-md transition-colors ${
              card.completed
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-white text-gray-600 hover:bg-green-50 hover:text-green-600'
            }`}
            title={card.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onQuickEdit}
            className="p-1.5 bg-white text-gray-600 rounded shadow-md hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Edit card"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onQuickArchive}
            className="p-1.5 bg-white text-gray-600 rounded shadow-md hover:bg-orange-50 hover:text-orange-600 transition-colors"
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
        <div className="flex items-start gap-2">
          {card.completed && (
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
          <p className={`text-sm ${card.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {card.title}
          </p>
        </div>
        {(card.startDate || card.dueDate || card.description) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            {card.startDate && (
              <span className="flex items-center text-blue-600">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(card.startDate).toLocaleDateString()}
              </span>
            )}
            {card.dueDate && (
              <span className={`flex items-center ${card.completed ? 'text-green-600' : ''}`}>
                <Calendar className="h-3 w-3 mr-1" />
                {new Date(card.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
        {/* Member Avatars */}
        {card.members && card.members.length > 0 && (
          <div className="flex items-center justify-end gap-1 mt-2">
            {card.members.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                title={member.name}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {card.members.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium">
                +{card.members.length - 3}
              </div>
            )}
          </div>
        )}
        {/* Custom Fields */}
        {cardCustomFieldValues.length > 0 && customFieldDefs.length > 0 && (
          <div className="mt-2 space-y-1">
            {cardCustomFieldValues.slice(0, 2).map((cfv) => {
              const fieldDef = customFieldDefs.find((d) => d.id === cfv.definitionId);
              if (!fieldDef || !cfv.value) return null;

              // Format value based on type
              let displayValue = cfv.value;
              if (fieldDef.type === 'date' && cfv.value) {
                displayValue = new Date(cfv.value).toLocaleDateString();
              } else if (fieldDef.type === 'checkbox') {
                displayValue = cfv.value === 'true' ? 'Yes' : 'No';
              }

              return (
                <div key={cfv.id} className="flex items-center text-xs text-gray-500">
                  <span className="font-medium text-gray-600 truncate max-w-[60px]">{fieldDef.title}:</span>
                  <span className="ml-1 truncate">{displayValue}</span>
                </div>
              );
            })}
            {cardCustomFieldValues.length > 2 && (
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
  workspaceMembers,
  onClose,
  onUpdate,
  onDelete,
  onArchive,
  onCopy,
  customFieldDefs,
  initialCustomFieldValues,
  onCustomFieldChange,
}: {
  card: Card;
  listTitle: string;
  workspaceMembers: WorkspaceMember[];
  onClose: () => void;
  onUpdate: (cardId: string, updates: Partial<Card>) => void;
  onDelete: () => void;
  onArchive: () => void;
  onCopy: () => void;
  customFieldDefs: CustomFieldDefinition[];
  initialCustomFieldValues: CustomFieldValue[];
  onCustomFieldChange: (cardId: string, values: CustomFieldValue[]) => void;
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
  const [newItemTitle, setNewItemTitle] = useState('');
  const [editingItemDueDate, setEditingItemDueDate] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
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
    currentUser ? card.watcherIds.includes(currentUser.id) : false
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

  // Custom field state
  const [customFieldValueMap, setCustomFieldValueMap] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    initialCustomFieldValues.forEach((v) => map.set(v.definitionId, v.value));
    return map;
  });
  const [isSavingCustomField, setIsSavingCustomField] = useState(false);

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

    setIsMoving(true);
    try {
      await updateCard(card.id, { listId: selectedListId, position: 0 });
      setShowMoveModal(false);
      // Close the modal since the card is now on a different board
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

  const handleAddChecklistItem = async (checklistId: string) => {
    if (!newItemTitle.trim()) return;
    try {
      const checklist = checklists.find((c) => c.id === checklistId);
      const position = checklist?.items.length || 0;
      const item = await createChecklistItem(checklistId, newItemTitle, position);
      setChecklists(checklists.map((c) =>
        c.id === checklistId ? { ...c, items: [...c.items, item] } : c
      ));
      setNewItemTitle('');
      setAddingItemToChecklist(null);
    } catch (err) {
      console.error('Failed to create checklist item:', err);
    }
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string, completed: boolean) => {
    try {
      const updated = await updateChecklistItem(itemId, { completed: !completed });
      setChecklists(checklists.map((c) =>
        c.id === checklistId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? updated : i)) }
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
          ? { ...c, items: c.items.filter((i) => i.id !== itemId) }
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
          ? { ...c, items: c.items.map((i) => i.id === itemId ? { ...i, dueDate: dueDate || undefined } : i) }
          : c
      ));
      setEditingItemDueDate(null);
    } catch (err) {
      console.error('Failed to update checklist item due date:', err);
    }
  };

  const getChecklistProgress = (checklist: Checklist) => {
    if (checklist.items.length === 0) return 0;
    const completed = checklist.items.filter((i) => i.completed).length;
    return Math.round((completed / checklist.items.length) * 100);
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
    const newLabels = card.labels.includes(label)
      ? card.labels.filter((l) => l !== label)
      : [...card.labels, label];
    onUpdate(card.id, { labels: newLabels });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
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

          <div className="grid grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="col-span-2 space-y-6">
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

              {/* Members */}
              {cardMembers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Members</h4>
                  <div className="flex flex-wrap gap-2">
                    {cardMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
                        title={member.email || member.name}
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-gray-700">{member.name}</span>
                        <button
                          onClick={() => handleToggleMember(member.id, member.name)}
                          className="ml-1 text-gray-400 hover:text-red-500"
                          disabled={isTogglingMember}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
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
                      <div key={checklist.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-800">{checklist.title}</h5>
                          <button
                            onClick={() => handleDeleteChecklist(checklist.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Progress bar */}
                        {checklist.items.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                              <span>{getChecklistProgress(checklist)}%</span>
                              <span>{checklist.items.filter((i) => i.completed).length}/{checklist.items.length}</span>
                            </div>
                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${getChecklistProgress(checklist)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Items */}
                        <div className="space-y-1">
                          {checklist.items.map((item) => (
                            <div key={item.id} className="flex items-center group">
                              <button
                                onClick={() => handleToggleChecklistItem(checklist.id, item.id, item.completed)}
                                className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center mr-2 ${
                                  item.completed
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-gray-300 hover:border-blue-500'
                                }`}
                              >
                                {item.completed && <Check className="h-3 w-3" />}
                              </button>
                              <span className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                {item.title}
                              </span>
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
                              <button
                                onClick={() => handleDeleteChecklistItem(checklist.id, item.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
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
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            />
                            <div className="flex space-x-2 mt-1">
                              <button
                                onClick={() => handleAddChecklistItem(checklist.id)}
                                className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => {
                                  setAddingItemToChecklist(null);
                                  setNewItemTitle('');
                                }}
                                className="text-gray-600 px-2 py-1 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingItemToChecklist(checklist.id)}
                            className="mt-2 text-sm text-gray-500 hover:text-gray-700 flex items-center"
                          >
                            <Plus className="h-3 w-3 mr-1" />
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
                                currentUser && reaction.userIds.includes(currentUser.id)
                                  ? 'bg-blue-50 border-blue-300'
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <span className="mr-1">{reaction.type}</span>
                              <span className="text-gray-600">{reaction.userIds.length}</span>
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
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Activity
                </h4>

                {isLoadingActivities ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : activities.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No activity yet</p>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 10).map((activity) => {
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
                    {activities.length > 10 && (
                      <p className="text-xs text-gray-500 text-center">
                        +{activities.length - 10} more activities
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Actions */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Add to card</h4>
                <div className="space-y-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowMemberPicker(!showMemberPicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Members
                    </button>
                    {showMemberPicker && (
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10 w-64">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Assign members</h5>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {currentUser && (
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
                              {cardMembers.some((m) => m.id === currentUser.id) && (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setShowMemberPicker(false)}
                          className="w-full mt-3 text-gray-500 hover:text-gray-700 text-sm"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center">
                    <Tag className="h-4 w-4 mr-2" />
                    Labels
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded text-left text-sm flex items-center"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Due date
                    </button>
                    {showDatePicker && (
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10 w-64">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Set due date</h5>
                        <input
                          type="date"
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
                      <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10 w-64">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Set start date</h5>
                        <input
                          type="date"
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
                        card.labels.includes(label) ? 'ring-2 ring-offset-1 ring-gray-600' : ''
                      }`}
                      style={{ backgroundColor: LABEL_COLORS[label] }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Fields Section */}
              {customFieldDefs.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Custom Fields</h4>
                  <div className="space-y-3">
                    {customFieldDefs.map((fieldDef) => {
                      const currentValue = customFieldValueMap.get(fieldDef.id) || '';

                      return (
                        <div key={fieldDef.id} className="space-y-1">
                          <label className="text-xs font-medium text-gray-600">
                            {fieldDef.title}
                            {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                          </label>

                          {fieldDef.type === 'text' && (
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
                              onBlur={() => handleCustomFieldChange(fieldDef.id, currentValue)}
                              disabled={isSavingCustomField}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                              placeholder={`Enter ${fieldDef.title.toLowerCase()}`}
                            />
                          )}

                          {fieldDef.type === 'number' && (
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
                              onBlur={() => handleCustomFieldChange(fieldDef.id, currentValue)}
                              disabled={isSavingCustomField}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                              placeholder="0"
                            />
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Actions</h4>
                <div className="space-y-1">
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
                  <button
                    onClick={handleOpenMoveModal}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-left text-sm flex items-center"
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Move
                  </button>
                  <button
                    onClick={onCopy}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-left text-sm flex items-center"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
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
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Move Modal */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4">
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
