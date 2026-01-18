import { useState, useRef, useEffect, useMemo } from 'react';
import { useConfirmDialog } from '../../../lib/hooks/useConfirmDialog';
import {
  X,
  Loader2,
  Calendar,
  Tag,
  Trash2,
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
  Eye,
  EyeOff,
  LayoutTemplate,
  SmilePlus,
  User,
  Settings2,
  Mail,
  Phone,
  Link2,
  Pin,
  Briefcase,
  Building2,
  Plus,
  ArrowRightLeft,
  ChevronDown,
  Star,
  ArrowRight,
} from 'lucide-react';
import { fetchAllBoards, type Board } from '../../../lib/api/boards';
import { fetchListsByBoard, type BoardList } from '../../../lib/api/lists';
import type { Card, CardLabel, CardMember } from '../../../lib/api/cards';
import {
  updateCard,
  watchCard,
  unwatchCard,
  assignMember,
  unassignMember,
  uploadCardCover,
  removeCardCover,
} from '../../../lib/api/cards';
import { fetchCommentsByCard, createComment, updateComment, deleteComment, toggleReaction, type CardComment, type ReactionType } from '../../../lib/api/comments';
import { fetchAttachmentsByCard, createAttachment, deleteAttachment, formatFileSize, type CardAttachment } from '../../../lib/api/attachments';
import { fetchChecklistsByCard, createChecklist, deleteChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem, updateChecklistItemAssignee, countChecklistItems, MAX_NESTING_DEPTH, type Checklist, type ChecklistItem } from '../../../lib/api/checklists';
import { fetchActivitiesByCard, getActivityDisplay, createActivity, type Activity } from '../../../lib/api/activities';
import { createTemplate, type ChecklistTemplate } from '../../../lib/api/templates';
import { createNotification } from '../../../lib/api/notifications';
import type { WorkspaceMember } from '../../../lib/api/workspaces';
import { setCardCustomFieldValue, enableCardScopedField, disableCardScopedField, getDisplayableFieldsForCard, getAvailableCardScopedFields, type CustomFieldDefinition, type CustomFieldValue } from '../../../lib/api/customFields';
import type { TaxonomyTerm } from '../../../lib/api/taxonomies';
import { useAuthStore } from '../../../lib/stores/auth';
import { toast } from '../../../lib/stores/toast';
import { TimeTracker } from '../../TimeTracker';
import { formatDate, formatDateTime, formatDateTimeCompact, formatDateCompact, formatDateRange } from '../../../lib/utils/date';
import { renderWordDiff } from '../../../lib/utils/diff';
import { EstimateEditor } from '../../EstimateEditor';
import { GoogleDocsEmbed } from '../../GoogleDocsEmbed';
import MemberDropdown from '../../MemberDropdown';
import CardRelationships from '../../CardRelationships';
import { LABEL_COLORS } from '../constants';

function CardDetailModal({
  card,
  listTitle,
  boardId,
  workspaceMembers,
  allUsers,
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
  canArchiveCard,
  canMoveCard,
  onMove,
  onApprove,
  onReject,
  onClearStatus,
  onGoogleDocAdd,
  onGoogleDocRemove,
  newMercureComment,
  deletedMercureCommentId,
}: {
  card: Card;
  listTitle: string;
  boardId?: string;
  workspaceMembers: WorkspaceMember[];
  allUsers: WorkspaceMember[];
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
  canArchiveCard: boolean;
  canMoveCard: boolean;
  onMove: (cardId: string, fromListId: string, toListId: string) => void;
  // Approval/Rejection
  onApprove: (cardId: string) => Promise<void>;
  onReject: (cardId: string) => Promise<void>;
  onClearStatus: (cardId: string) => Promise<void>;
  onGoogleDocAdd: (cardId: string, url: string, title: string) => Promise<void>;
  onGoogleDocRemove: (cardId: string, url: string) => Promise<void>;
  // Real-time comment from Mercure
  newMercureComment?: CardComment | null;
  // Deleted comment ID from Mercure
  deletedMercureCommentId?: string | null;
}) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
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

  // Approval state
  const [isApproving, setIsApproving] = useState(false);

  // Member state
  const [cardMembers, setCardMembers] = useState<CardMember[]>(card.members || []);
  const [isTogglingMember, setIsTogglingMember] = useState(false);

  // Sync cardMembers when card.members changes (from Mercure real-time updates)
  useEffect(() => {
    setCardMembers(card.members || []);
  }, [card.members]);

  // Watchers state
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

  // Handle real-time comments from Mercure
  useEffect(() => {
    if (newMercureComment && newMercureComment.cardId === card.id) {
      // Check if comment already exists to avoid duplicates
      setComments((prev) => {
        const exists = prev.some((c) => c.id === newMercureComment.id);
        if (exists) return prev;
        return [newMercureComment, ...prev];
      });
      // Refresh activities to show the new comment activity
      fetchActivitiesByCard(card.id).then(setActivities).catch(console.error);
    }
  }, [newMercureComment, card.id]);

  // Handle real-time comment deletions from Mercure
  useEffect(() => {
    if (deletedMercureCommentId) {
      setComments((prev) => prev.filter((c) => c.id !== deletedMercureCommentId));
      // Refresh activities to show the comment deletion activity
      fetchActivitiesByCard(card.id).then(setActivities).catch(console.error);
    }
  }, [deletedMercureCommentId, card.id]);

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
      // Set author name from current user since POST response doesn't include user data
      comment.authorName = currentUser?.displayName || currentUser?.username || comment.authorName;
      comment.authorId = currentUser?.id || comment.authorId;
      setComments([comment, ...comments]);

      // Refresh activities to show the new comment activity
      const cardActivities = await fetchActivitiesByCard(card.id);
      setActivities(cardActivities);

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
      // Refresh activities to show the comment update activity
      const cardActivities = await fetchActivitiesByCard(card.id);
      setActivities(cardActivities);
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = await confirm({
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteComment(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
      // Refresh activities to show the comment deletion activity
      const cardActivities = await fetchActivitiesByCard(card.id);
      setActivities(cardActivities);
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
    const confirmed = await confirm({
      title: 'Delete Attachment',
      message: 'Are you sure you want to delete this attachment? This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
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
        const updatedCard = await unwatchCard(card.id, currentUser.id);
        // Update the card's watcherIds in the parent state to preserve all data
        onUpdate(card.id, {
          watcherIds: updatedCard.watcherIds,
          watchers: updatedCard.watchers,
          memberIds: updatedCard.memberIds,
          members: updatedCard.members,
        });
        setIsWatching(false);
        // Create activity for stopped watching and refresh activities
        try {
          await createActivity({
            type: 'watcher_removed',
            description: `${currentUser?.displayName || 'User'} stopped watching "${card.title}"`,
            cardId: card.id,
            boardId: boardId || undefined,
          });
          const cardActivities = await fetchActivitiesByCard(card.id);
          setActivities(cardActivities);
        } catch (activityErr) {
          console.error('Failed to create watcher activity:', activityErr);
        }
      } else {
        const updatedCard = await watchCard(card.id, currentUser.id);
        // Update the card's watcherIds in the parent state to preserve all data
        onUpdate(card.id, {
          watcherIds: updatedCard.watcherIds,
          watchers: updatedCard.watchers,
          memberIds: updatedCard.memberIds,
          members: updatedCard.members,
        });
        setIsWatching(true);
        // Create activity for started watching and refresh activities
        try {
          await createActivity({
            type: 'watcher_added',
            description: `${currentUser?.displayName || 'User'} started watching "${card.title}"`,
            cardId: card.id,
            boardId: boardId || undefined,
          });
          const cardActivities = await fetchActivitiesByCard(card.id);
          setActivities(cardActivities);
        } catch (activityErr) {
          console.error('Failed to create watcher activity:', activityErr);
        }
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
      const updatedCard = await watchCard(card.id, userId);
      // Update the card's watcherIds and members in the parent state
      onUpdate(card.id, {
        watcherIds: updatedCard.watcherIds,
        watchers: updatedCard.watchers,
        memberIds: updatedCard.memberIds,
        members: updatedCard.members,
      });
      toast.success(`${userName} added as watcher`);
      // Create activity for watcher added and refresh activities
      try {
        await createActivity({
          type: 'watcher_added',
          description: `${currentUser?.displayName || 'User'} added ${userName} as watcher on "${card.title}"`,
          cardId: card.id,
          boardId: boardId || undefined,
        });
        // Refresh activities list
        const cardActivities = await fetchActivitiesByCard(card.id);
        setActivities(cardActivities);
      } catch (activityErr) {
        console.error('Failed to create watcher activity:', activityErr);
      }
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
      const updatedCard = await unwatchCard(card.id, userId);
      // Update the card's watcherIds and members in the parent state
      onUpdate(card.id, {
        watcherIds: updatedCard.watcherIds,
        watchers: updatedCard.watchers,
        memberIds: updatedCard.memberIds,
        members: updatedCard.members,
      });
      toast.success(`${userName} removed as watcher`);
      // Create activity for watcher removed and refresh activities
      try {
        await createActivity({
          type: 'watcher_removed',
          description: `${currentUser?.displayName || 'User'} removed ${userName} as watcher from "${card.title}"`,
          cardId: card.id,
          boardId: boardId || undefined,
        });
        // Refresh activities list
        const cardActivities = await fetchActivitiesByCard(card.id);
        setActivities(cardActivities);
      } catch (activityErr) {
        console.error('Failed to create watcher activity:', activityErr);
      }
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
      const hadDepartment = !!card.department;
      await onDepartmentChange(card.id, departmentId);
      const dept = departments.find((d) => d.id === departmentId);
      toast.success(departmentId ? `Department set to ${dept?.name}` : 'Department removed');
      setShowDepartmentPicker(false);
      // Create activity for department change
      const activityType = departmentId
        ? (hadDepartment ? 'department_changed' : 'department_set')
        : 'department_removed';
      const description = departmentId
        ? `set department to "${dept?.name}"`
        : 'removed department';
      createActivity({
        type: activityType,
        description: `${currentUser?.displayName || 'User'} ${description} on "${card.title}"`,
        cardId: card.id,
        boardId: boardId || undefined,
      }).catch(console.error);
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
      const hadClient = !!card.client;
      await onClientChange(card.id, clientId);
      const clnt = clients.find((c) => c.id === clientId);
      toast.success(clientId ? `Client set to ${clnt?.name}` : 'Client removed');
      setShowClientPicker(false);
      // Create activity for client change
      const activityType = clientId
        ? (hadClient ? 'client_changed' : 'client_set')
        : 'client_removed';
      const description = clientId
        ? `set client to "${clnt?.name}"`
        : 'removed client';
      createActivity({
        type: activityType,
        description: `${currentUser?.displayName || 'User'} ${description} on "${card.title}"`,
        cardId: card.id,
        boardId: boardId || undefined,
      }).catch(console.error);
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
    const confirmed = await confirm({
      title: 'Delete Checklist',
      message: 'Are you sure you want to delete this checklist? All items in this checklist will be deleted. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
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

  const formatActivityTime = (dateStr: string): { fullDate: string; relative: string } => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Full date format: "Jan 15, 2026, 2:30:45 PM"
    const fullDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });

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
      relative = `${Math.floor(diffDays / 7)}w ago`;
    }

    return { fullDate, relative };
  };

  const formatDateValue = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleTitleBlur = async () => {
    if (title.trim() && title !== card.title) {
      onUpdate(card.id, { title });
      // Wait a moment for backend to create activity, then refetch
      setTimeout(async () => {
        try {
          const cardActivities = await fetchActivitiesByCard(card.id);
          setActivities(cardActivities);
        } catch (error) {
          console.error('Failed to refetch activities after title update:', error);
        }
      }, 500);
    } else {
      setTitle(card.title);
    }
  };

  const handleDescriptionSave = async () => {
    if (description !== card.description) {
      onUpdate(card.id, { description });
      // Wait a moment for backend to create activity, then refetch
      setTimeout(async () => {
        try {
          const cardActivities = await fetchActivitiesByCard(card.id);
          setActivities(cardActivities);
        } catch (error) {
          console.error('Failed to refetch activities after description update:', error);
        }
      }, 500);
    }
    setEditingDescription(false);
  };

  const handleDueDateSave = (date: string) => {
    // Validate: due date must not be before start date
    if (date && startDate) {
      const dueDateObj = new Date(date);
      const startDateObj = new Date(startDate);
      if (dueDateObj < startDateObj) {
        toast.error('Due date cannot be before the start date');
        return;
      }
    }
    setDueDate(date);
    onUpdate(card.id, { dueDate: date || undefined });
    setShowDatePicker(false);
    // Wait a moment for backend to create activity, then refetch
    setTimeout(async () => {
      try {
        const cardActivities = await fetchActivitiesByCard(card.id);
        setActivities(cardActivities);
      } catch (error) {
        console.error('Failed to refetch activities after due date update:', error);
      }
    }, 500);
  };

  const handleRemoveDueDate = () => {
    setDueDate('');
    onUpdate(card.id, { dueDate: undefined });
    setShowDatePicker(false);
    // Wait a moment for backend to create activity, then refetch
    setTimeout(async () => {
      try {
        const cardActivities = await fetchActivitiesByCard(card.id);
        setActivities(cardActivities);
      } catch (error) {
        console.error('Failed to refetch activities after due date removal:', error);
      }
    }, 500);
  };

  const handleStartDateSave = async (date: string) => {
    // Validate: start date must not be after due date
    if (date && dueDate) {
      const startDateObj = new Date(date);
      const dueDateObj = new Date(dueDate);
      if (startDateObj > dueDateObj) {
        toast.error('Start date cannot be after the due date');
        return;
      }
    }
    setStartDate(date);
    onUpdate(card.id, { startDate: date || undefined });
    setShowStartDatePicker(false);
    // Wait a moment for backend to create activity, then refetch
    setTimeout(async () => {
      try {
        const cardActivities = await fetchActivitiesByCard(card.id);
        setActivities(cardActivities);
      } catch (error) {
        console.error('Failed to refetch activities after start date update:', error);
      }
    }, 500);
  };

  const handleRemoveStartDate = () => {
    setStartDate('');
    onUpdate(card.id, { startDate: undefined });
    setShowStartDatePicker(false);
    // Wait a moment for backend to create activity, then refetch
    setTimeout(async () => {
      try {
        const cardActivities = await fetchActivitiesByCard(card.id);
        setActivities(cardActivities);
      } catch (error) {
        console.error('Failed to refetch activities after start date removal:', error);
      }
    }, 500);
  };

  const toggleLabel = (label: CardLabel) => {
    const currentLabels = card.labels || [];
    const newLabels = currentLabels.includes(label)
      ? currentLabels.filter((l) => l !== label)
      : [...currentLabels, label];
    onUpdate(card.id, { labels: newLabels });
    // Wait a moment for backend to create activity, then refetch
    setTimeout(async () => {
      try {
        const cardActivities = await fetchActivitiesByCard(card.id);
        setActivities(cardActivities);
      } catch (error) {
        console.error('Failed to refetch activities after label toggle:', error);
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
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
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500'
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
                  className={`text-xl font-semibold w-full outline-none focus:bg-gray-50 dark:focus:bg-gray-700 px-2 py-1 -ml-2 rounded ${
                    card.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'
                  }`}
                />
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">in list</span>
                  <button
                    onClick={onClose}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium text-sm rounded border border-blue-200 dark:border-blue-700 transition-colors"
                    title="Click to view list"
                  >
                    {listTitle}
                  </button>
                  {card.completed && <span className="text-green-600 dark:text-green-400 font-medium text-sm">Completed</span>}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {/* Main Content - 75% */}
            <div className="col-span-3 space-y-6">
              {/* Labels */}
              {card.labels.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Labels</h4>
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

              {/* Date Display - Smart format when both dates on same day */}
              {(() => {
                const dateRange = formatDateRange(startDate, dueDate);
                if (dateRange?.combined) {
                  // Both dates on same day - show combined format
                  return (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Date & Time</h4>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium ${
                          new Date(dueDate) < new Date() ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          <Clock className="h-4 w-4 mr-2" />
                          {dateRange.display}
                          {new Date(dueDate) < new Date() && ' (overdue)'}
                        </span>
                        <button
                          onClick={() => setShowStartDatePicker(true)}
                          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                }
                // Separate display for different days or single date
                return (
                  <>
                    {startDate && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Start Date</h4>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-700">
                            <Clock className="h-4 w-4 mr-2" />
                            {formatDateTimeCompact(startDate)}
                          </span>
                          <button
                            onClick={() => setShowStartDatePicker(true)}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
                    {dueDate && (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded text-sm font-medium ${
                            new Date(dueDate) < new Date() ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Due: {formatDateTimeCompact(dueDate)}
                            {new Date(dueDate) < new Date() && ' (overdue)'}
                          </span>
                          <button
                            onClick={() => setShowDatePicker(true)}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Approval/Rejection Section */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex flex-col gap-2">
                  {/* Status Display */}
                  {(card.isApproved || card.isRejected) && (
                    <div className={`flex items-center justify-between p-2 rounded-lg ${
                      card.isApproved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {card.isApproved ? (
                          <>
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Approved</span>
                            {card.approvedBy && (
                              <span className="text-sm text-green-600">
                                by <span className="font-medium">{card.approvedBy.name}</span>
                                {card.approvedAt && (
                                  <span className="text-green-500 ml-1">
                                    • {formatDateTime(card.approvedAt)}
                                  </span>
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <X className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-700">Rejected</span>
                            {card.rejectedBy && (
                              <span className="text-sm text-red-600">
                                by <span className="font-medium">{card.rejectedBy.name}</span>
                                {card.rejectedAt && (
                                  <span className="text-red-500 ml-1">
                                    • {formatDateTime(card.rejectedAt)}
                                  </span>
                                )}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          if (isApproving) return;
                          setIsApproving(true);
                          try {
                            await onClearStatus(card.id);
                            toast.success('Status cleared');
                            try {
                              await createActivity({
                                type: card.isApproved ? 'card_approval_removed' : 'card_rejection_removed',
                                description: `${currentUser?.displayName || 'User'} cleared ${card.isApproved ? 'approval' : 'rejection'} from "${card.title}"`,
                                cardId: card.id,
                                boardId: boardId || undefined,
                              });
                              // Refresh activities list
                              const cardActivities = await fetchActivitiesByCard(card.id);
                              setActivities(cardActivities);
                            } catch (activityErr) {
                              console.error('Failed to create activity:', activityErr);
                            }
                          } catch {
                            toast.error('Failed to clear status');
                          } finally {
                            setIsApproving(false);
                          }
                        }}
                        disabled={isApproving}
                        className={`text-xs hover:underline ${card.isApproved ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {!card.isApproved && !card.isRejected && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (isApproving) return;
                          setIsApproving(true);
                          try {
                            await onApprove(card.id);
                            toast.success('Card approved');
                            try {
                              await createActivity({
                                type: 'card_approved',
                                description: `${currentUser?.displayName || 'User'} approved "${card.title}"`,
                                cardId: card.id,
                                boardId: boardId || undefined,
                              });
                              // Refresh activities list
                              const cardActivities = await fetchActivitiesByCard(card.id);
                              setActivities(cardActivities);
                            } catch (activityErr) {
                              console.error('Failed to create activity:', activityErr);
                            }
                          } catch {
                            toast.error('Failed to approve card');
                          } finally {
                            setIsApproving(false);
                          }
                        }}
                        disabled={isApproving || !currentUser}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/50 hover:text-green-700 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-600 border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                      >
                        {isApproving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          if (isApproving) return;
                          setIsApproving(true);
                          try {
                            await onReject(card.id);
                            toast.success('Card rejected');
                            try {
                              await createActivity({
                                type: 'card_rejected',
                                description: `${currentUser?.displayName || 'User'} rejected "${card.title}"`,
                                cardId: card.id,
                                boardId: boardId || undefined,
                              });
                              // Refresh activities list
                              const cardActivities = await fetchActivitiesByCard(card.id);
                              setActivities(cardActivities);
                            } catch (activityErr) {
                              console.error('Failed to create activity:', activityErr);
                            }
                          } catch {
                            toast.error('Failed to reject card');
                          } finally {
                            setIsApproving(false);
                          }
                        }}
                        disabled={isApproving || !currentUser}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-700 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                      >
                        {isApproving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Description
                </h4>
                {editingDescription ? (
                  <div>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:border-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                        className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingDescription(true)}
                    className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-20"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-20"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
                                >
                                  {currentValue ? formatDate(currentValue, 'medium') : `Select ${fieldDef.title.toLowerCase()}...`}
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
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
                                      className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingCustomFieldId(fieldDef.id)}
                                  className="w-full text-left p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 min-h-10"
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
                  <h4 className="text-sm font-medium text-gray-700 dark:text-white flex items-center">
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                        className="text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm"
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
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No checklists yet</p>
                ) : (
                  <div className="space-y-4">
                    {checklists.map((checklist) => (
                      <div key={checklist.id} className="bg-white border border-gray-200 rounded-xl shadow-sm">
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
                                          <span> • {formatDateTime(item.completedAt)}</span>
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
                                      <>
                                        <div className="fixed inset-0 z-[9998]" onClick={() => setEditingItemAssignee(null)} />
                                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[9999] w-56">
                                          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Assign to</p>
                                          </div>
                                          <div className="max-h-48 overflow-y-auto">
                                            {allUsers.map((member) => (
                                              <button
                                                key={member.id}
                                                onClick={() => handleUpdateChecklistItemAssignee(checklist.id, item.id, member.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left ${
                                                  item.assigneeId === member.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                                }`}
                                              >
                                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                                  {member.displayName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{member.displayName}</span>
                                                {item.assigneeId === member.id && (
                                                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                )}
                                              </button>
                                            ))}
                                          </div>
                                          {item.assignee && (
                                            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                                              <button
                                                onClick={() => handleUpdateChecklistItemAssignee(checklist.id, item.id, null)}
                                                className="w-full text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-left px-1"
                                              >
                                                Remove assignee
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </>
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
                                        {formatDateCompact(item.dueDate)}
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
                                        className="text-gray-600 dark:text-gray-300 px-2 py-1 text-xs"
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
                <h4 className="text-sm font-medium text-gray-700 dark:text-white mb-3 flex items-center">
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
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No attachments yet</p>
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

              {/* Time Tracking */}
              <TimeTracker cardId={card.id} cardTitle={card.title} />

              {/* Estimates */}
              <EstimateEditor
                card={card}
                onUpdate={onUpdate}
                canEdit={canEditCard}
              />

              {/* Google Docs */}
              <GoogleDocsEmbed
                docs={card.googleDocs || []}
                onAdd={async (url, title) => {
                  await onGoogleDocAdd(card.id, url, title);
                }}
                onRemove={async (url) => {
                  await onGoogleDocRemove(card.id, url);
                }}
                canEdit={canEditCard}
              />

              {/* Comments */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-white mb-3 flex items-center">
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
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No comments yet</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center mb-1">
                            <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium mr-2">
                              {comment.authorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-800 dark:text-white">{comment.authorName}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                {formatDateTime(comment.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => {
                                setEditingCommentId(comment.id);
                                setEditingCommentText(comment.text);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
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
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                                className="text-gray-600 dark:text-gray-300 px-3 py-1 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 dark:text-gray-300 ml-9">{comment.text}</p>
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
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    Activity
                    {activities.length > 0 && (
                      <span className="text-xs font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {activities.length}
                      </span>
                    )}
                  </span>
                  {activities.length > 5 && (
                    <button
                      onClick={() => setShowAllActivities(!showAllActivities)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-normal hover:underline"
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
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No activity yet</p>
                ) : (
                  <div className={`space-y-2 ${showAllActivities ? 'max-h-96 overflow-y-auto pr-2' : ''}`}>
                    {(showAllActivities ? activities : activities.slice(0, 5)).map((activity) => {
                      const display = getActivityDisplay(activity.type);
                      const time = formatActivityTime(activity.createdAt);
                      const data = activity.data;
                      const hasStructuredData = data && (
                        data.from_list || data.to_list || data.old_value || data.new_value ||
                        data.due_date || data.start_date || data.label || data.member_name ||
                        data.comment_text || data.field_name || data.checklist_name
                      );
                      return (
                        <div key={activity.id} className="flex items-start p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs mr-2.5 flex-shrink-0 font-medium">
                            {activity.authorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-medium text-gray-800 dark:text-white">{activity.authorName}</span>{' '}
                              <span className="text-gray-600 dark:text-gray-400">{display.label}</span>
                            </p>
                            {/* Title updated - show word diff if both values exist, or just new value */}
                            {activity.type === 'title_updated' && (data?.old_value || data?.new_value) && (
                              <div className="mt-1 text-xs">
                                <div className="bg-gray-100 text-gray-700 px-2 py-1.5 rounded">
                                  {data?.old_value && data?.new_value ? (
                                    renderWordDiff(data.old_value, data.new_value)
                                  ) : data?.new_value ? (
                                    <span className="bg-green-100 text-green-700 px-1 rounded">{data.new_value}</span>
                                  ) : (
                                    <span className="text-gray-500">{data?.old_value}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* Description updated - show word diff if both values exist, or just new value */}
                            {activity.type === 'description_updated' && (data?.old_value || data?.new_value) && (
                              <div className="mt-1 text-xs">
                                <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded line-clamp-3">
                                  {data?.old_value && data?.new_value ? (
                                    renderWordDiff(data.old_value, data.new_value)
                                  ) : data?.new_value ? (
                                    <span className="bg-green-100 text-green-700 px-1 rounded">{data.new_value}</span>
                                  ) : (
                                    <span className="bg-red-100 text-red-700 px-1 rounded line-through">{data?.old_value}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* Card moved - show from/to lists */}
                            {activity.type === 'card_moved' && data?.from_list && data?.to_list && (
                              <div className="mt-1 flex items-center gap-1.5 text-xs">
                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded line-through">{data.from_list}</span>
                                <ArrowRight className="h-3 w-3 text-gray-400" />
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{data.to_list}</span>
                              </div>
                            )}
                            {/* Due date changes */}
                            {(activity.type === 'due_date_set' || activity.type === 'due_date_updated') && (data?.new_value || data?.due_date) && (
                              <div className="mt-1 text-xs">
                                {data?.old_value && (
                                  <>
                                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded line-through mr-1.5">{formatDateValue(data.old_value)}</span>
                                    <ArrowRight className="h-3 w-3 text-gray-400 inline mx-1" />
                                  </>
                                )}
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{formatDateValue(data?.new_value || data?.due_date || '')}</span>
                              </div>
                            )}
                            {activity.type === 'due_date_removed' && data?.old_value && (
                              <div className="mt-1 text-xs">
                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded line-through">{formatDateValue(data.old_value)}</span>
                              </div>
                            )}
                            {/* Start date changes */}
                            {(activity.type === 'start_date_set' || activity.type === 'start_date_updated') && (data?.new_value || data?.start_date) && (
                              <div className="mt-1 text-xs">
                                {data?.old_value && (
                                  <>
                                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded line-through mr-1.5">{formatDateValue(data.old_value)}</span>
                                    <ArrowRight className="h-3 w-3 text-gray-400 inline mx-1" />
                                  </>
                                )}
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{formatDateValue(data?.new_value || data?.start_date || '')}</span>
                              </div>
                            )}
                            {/* Label changes */}
                            {(activity.type === 'label_added' || activity.type === 'label_removed') && data?.label && (
                              <div className="mt-1 text-xs">
                                <span className={`px-1.5 py-0.5 rounded ${activity.type === 'label_added' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 line-through'}`}>
                                  {data.label}
                                </span>
                              </div>
                            )}
                            {/* Member changes */}
                            {(activity.type === 'member_added' || activity.type === 'member_removed') && data?.member_name && (
                              <div className="mt-1 text-xs">
                                <span className={`px-1.5 py-0.5 rounded ${activity.type === 'member_added' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                  {data.member_name}
                                </span>
                              </div>
                            )}
                            {/* Comment added - show comment text */}
                            {activity.type === 'comment_added' && data?.comment_text && (
                              <div className="mt-1 text-xs">
                                <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded italic">
                                  "{data.comment_text}"
                                </div>
                              </div>
                            )}
                            {/* Comment updated - show inline word diff */}
                            {activity.type === 'comment_updated' && data?.old_value && data?.new_value && (
                              <div className="mt-1 text-xs">
                                <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded italic">
                                  "{renderWordDiff(data.old_value, data.new_value)}"
                                </div>
                              </div>
                            )}
                            {/* Comment updated fallback - just show new text if no old value */}
                            {activity.type === 'comment_updated' && data?.comment_text && !data?.old_value && (
                              <div className="mt-1 text-xs">
                                <div className="bg-green-50 text-green-700 px-2 py-1.5 rounded italic">
                                  "{data.comment_text}"
                                </div>
                              </div>
                            )}
                            {/* Custom field changes - use word diff for longer text, simple format for short values */}
                            {activity.type === 'custom_field_updated' && data?.field_name && (
                              <div className="mt-1 text-xs">
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  <span className="font-medium text-gray-600 dark:text-gray-300">{data.field_name}:</span>
                                  {data.old_value && data.new_value ? (
                                    // Use word diff for longer text (more than 20 chars total)
                                    (data.old_value.length + data.new_value.length > 20) ? (
                                      <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                        {renderWordDiff(data.old_value, data.new_value)}
                                      </span>
                                    ) : (
                                      <>
                                        <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded line-through">{data.old_value}</span>
                                        <ArrowRight className="h-3 w-3 text-gray-400 mt-0.5" />
                                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{data.new_value}</span>
                                      </>
                                    )
                                  ) : data.new_value ? (
                                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{data.new_value}</span>
                                  ) : data.old_value ? (
                                    <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded line-through">{data.old_value}</span>
                                  ) : null}
                                </div>
                              </div>
                            )}
                            {/* Checklist added */}
                            {activity.type === 'checklist_added' && data?.checklist_name && (
                              <div className="mt-1 text-xs">
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{data.checklist_name}</span>
                              </div>
                            )}
                            {/* Fallback description if no structured data */}
                            {activity.description && !hasStructuredData && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.description}</p>
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{time.fullDate} · {time.relative}</p>
                          </div>
                        </div>
                      );
                    })}
                    {!showAllActivities && activities.length > 5 && (
                      <button
                        onClick={() => setShowAllActivities(true)}
                        className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-center py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
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
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2 flex items-center gap-2">
                  Add to card
                  {cardMembers.length > 0 && (
                    <span className="text-blue-600 normal-case font-normal">
                      • {cardMembers[0].name}
                    </span>
                  )}
                </h4>
                <div className="space-y-2">
                  {/* Member Assignment Dropdown */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Assign member (1 max)</p>
                    {cardMembers.length > 0 ? (
                      <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                            {cardMembers[0].name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-200">{cardMembers[0].name}</span>
                        </div>
                        <button
                          onClick={() => handleToggleMember(cardMembers[0].id, cardMembers[0].name)}
                          disabled={isTogglingMember}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          {isTogglingMember ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                        </button>
                      </div>
                    ) : (
                      <MemberDropdown
                        members={allUsers}
                        onSelect={(member) => handleToggleMember(member.id, member.displayName)}
                        placeholder="Assign member..."
                        buttonLabel="Assign Member"
                        showSelectedInButton={false}
                        disabled={isTogglingMember}
                        emptyMessage="No members available"
                      />
                    )}
                  </div>
                  <button
                    onClick={handleToggleWatch}
                    disabled={isTogglingWatch || !currentUser}
                    className={`w-full px-3 py-2 rounded text-left text-sm flex items-center ${
                      isWatching
                        ? 'bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900/70 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
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
                  {/* Watchers Dropdown */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Watchers {card.watcherIds && card.watcherIds.length > 0 && `(${card.watcherIds.length})`}
                    </p>
                    {/* Current watchers display */}
                    {card.watcherIds && card.watcherIds.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {allUsers
                          .filter((m) => card.watcherIds.includes(m.id))
                          .map((member) => (
                            <span
                              key={member.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                            >
                              {member.displayName}
                              <button
                                onClick={() => handleRemoveWatcher(member.id, member.displayName)}
                                disabled={isAddingWatcher}
                                className="hover:bg-blue-200 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                    <MemberDropdown
                      members={allUsers}
                      excludeIds={card.watcherIds || []}
                      onSelect={(member) => handleAddWatcher(member.id, member.displayName)}
                      placeholder="Add watcher..."
                      buttonLabel="Add Watcher"
                      showSelectedInButton={false}
                      disabled={isAddingWatcher}
                      emptyMessage="All members are watching"
                    />
                  </div>
                  <button className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded text-left text-sm flex items-center text-gray-700 dark:text-gray-300">
                    <Tag className="h-4 w-4 mr-2" />
                    Labels
                  </button>
                  {/* Add Card-Scoped Custom Fields */}
                  {availableCardFields.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowCardFieldsPicker(!showCardFieldsPicker)}
                        className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded text-left text-sm flex items-center justify-between text-gray-700 dark:text-gray-300"
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
                        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10 w-64">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Add Custom Fields</h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Select card-specific fields to add:</p>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {availableCardFields.map((field) => (
                              <button
                                key={field.id}
                                onClick={() => handleAddCardField(field.id)}
                                disabled={isAddingCardField}
                                className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left disabled:opacity-50"
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
                                  <span className="text-sm text-gray-700 dark:text-gray-200">{field.title}</span>
                                  <span className="block text-xs text-gray-400 dark:text-gray-500 capitalize">{field.type}</span>
                                </div>
                                <Plus className="h-4 w-4 text-gray-400" />
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setShowCardFieldsPicker(false)}
                            className="w-full mt-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="relative">
                    <button
                      onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                      className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded text-left text-sm flex items-center text-gray-700 dark:text-gray-300"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Start date
                    </button>
                    {showStartDatePicker && (
                      <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10 w-72">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Set start date & time</h5>
                        <input
                          type="datetime-local"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          max={dueDate || undefined}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        {dueDate && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Must be before or on the due date</p>
                        )}
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
                          className="w-full mt-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded text-left text-sm flex items-center text-gray-700 dark:text-gray-300"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Due date
                    </button>
                    {showDatePicker && (
                      <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10 w-72">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Set due date & time</h5>
                        <input
                          type="datetime-local"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          min={startDate || undefined}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        {startDate && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Must be on or after the start date</p>
                        )}
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
                          className="w-full mt-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Department Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDepartmentPicker(!showDepartmentPicker)}
                      className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded text-left text-sm flex items-center justify-between text-gray-700 dark:text-gray-300"
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
                        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-[52] w-64">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Select Department</h5>
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
                            className="w-full mt-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
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
                      className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-2 rounded text-left text-sm flex items-center justify-between text-gray-700 dark:text-gray-300"
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
                        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-[52] w-64">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Select Client</h5>
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
                            className="w-full mt-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </>
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
                                    className="text-gray-600 dark:text-gray-300 px-2 py-1 text-xs"
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
                                    className="text-gray-600 dark:text-gray-300 px-2 py-1 text-xs"
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
                  {canArchiveCard && (
                    <button
                      onClick={onArchive}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-left text-sm flex items-center"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </button>
                  )}
                  {canDeleteCard && (
                    <>
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

        <ConfirmDialog />
      </div>
    </div>
  );
}

export { CardDetailModal };
