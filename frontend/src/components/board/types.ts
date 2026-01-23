import type { Card } from '../../lib/api/cards';
import type { BoardList } from '../../lib/api/lists';
import type { CustomFieldDefinition, CustomFieldValue } from '../../lib/api/customFields';
import type { WorkspaceMember } from '../../lib/api/workspaces';
import type { TaxonomyTerm } from '../../lib/api/taxonomies';

export interface CardFieldVisibility {
  labels: boolean;
  startDate: boolean;
  dueDate: boolean;
  members: boolean;
  customFields: boolean;
  expanded: boolean;
  checklists: boolean;
  comments: boolean;
}

export const DEFAULT_FIELD_VISIBILITY: CardFieldVisibility = {
  labels: true,
  startDate: true,
  dueDate: true,
  members: true,
  customFields: false,
  expanded: false,
  checklists: true,
  comments: true,
};

export interface SortableListProps {
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
  fieldVisibility: CardFieldVisibility;
  canCreateCard: boolean;
  canEditList: boolean;
  canDeleteList: boolean;
  canArchiveCard: (authorId: string) => boolean;
}

export interface SortableCardProps {
  card: Card;
  onClick: () => void;
  onQuickComplete: (e: React.MouseEvent) => void;
  onQuickArchive: (e: React.MouseEvent) => void;
  onQuickEdit: (e: React.MouseEvent) => void;
  customFieldDefs: CustomFieldDefinition[];
  cardCustomFieldValues: CustomFieldValue[];
  searchQuery?: string;
  fieldVisibility: CardFieldVisibility;
  canArchiveCard: boolean;
}

export interface CardDetailModalProps {
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
  canEditCard: boolean;
  canDeleteCard: boolean;
  canArchiveCard: boolean;
  canMoveCard: boolean;
  onMove: (cardId: string, fromListId: string, toListId: string) => void;
  onApprove: (cardId: string) => Promise<void>;
  onReject: (cardId: string) => Promise<void>;
  onClearStatus: (cardId: string) => Promise<void>;
  onGoogleDocAdd: (cardId: string, url: string, title: string) => Promise<void>;
  onGoogleDocRemove: (cardId: string, url: string) => Promise<void>;
  onSharePointDocAdd: (cardId: string, url: string, title: string) => Promise<void>;
  onSharePointDocRemove: (cardId: string, url: string) => Promise<void>;
}

export interface CardDragOverlayProps {
  card: Card | null;
}

export interface ListDragOverlayProps {
  list: BoardList | null;
  cards: Card[];
}
