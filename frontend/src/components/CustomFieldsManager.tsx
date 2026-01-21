import { useState, useEffect, useMemo } from 'react';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';
import { Select } from './ui/select';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Loader2,
  Settings,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  AlignLeft,
  Link,
  Mail,
  DollarSign,
  Star,
  Phone,
  PanelLeft,
  PanelRight,
  Globe,
  LayoutGrid,
  FileBox,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  fetchCustomFieldsByBoard,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomFieldDefinition,
  type CustomFieldType,
  type CustomFieldDisplayLocation,
  type CustomFieldScope,
  type CreateCustomFieldData,
} from '../lib/api/customFields';
import { toast } from '../lib/stores/toast';

interface CustomFieldsManagerProps {
  boardId: string;
  workspaceId?: string; // For workspace-scoped fields
  isOpen: boolean;
  onClose: () => void;
  onFieldsChange?: (fields: CustomFieldDefinition[]) => void;
}

const SCOPE_LABELS: Record<CustomFieldScope, string> = {
  workspace: 'Workspace',
  board: 'Board',
  card: 'Card',
};

const SCOPE_DESCRIPTIONS: Record<CustomFieldScope, string> = {
  workspace: 'Available to all boards in this workspace',
  board: 'Available to all cards in this board',
  card: 'Can be selectively added to individual cards',
};

const SCOPE_ICONS: Record<CustomFieldScope, React.ReactNode> = {
  workspace: <Globe className="h-4 w-4" />,
  board: <LayoutGrid className="h-4 w-4" />,
  card: <FileBox className="h-4 w-4" />,
};

const FIELD_TYPE_ICONS: Record<CustomFieldType, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  longtext: <AlignLeft className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  dropdown: <List className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
  url: <Link className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  currency: <DollarSign className="h-4 w-4" />,
  rating: <Star className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
};

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  longtext: 'Long Text',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  url: 'URL',
  email: 'Email',
  currency: 'Currency',
  rating: 'Rating',
  phone: 'Phone',
};

// Sortable field item component
interface SortableFieldItemProps {
  field: CustomFieldDefinition;
  onEdit: (field: CustomFieldDefinition) => void;
  onDelete: (field: CustomFieldDefinition) => void;
  isDragging?: boolean;
}

function SortableFieldItem({ field, onEdit, onDelete, isDragging }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg group border dark:border-gray-700 ${
        isDragging ? 'shadow-lg ring-2 ring-blue-500' : 'shadow-sm hover:shadow-md dark:shadow-gray-900'
      } transition-shadow`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="dark:text-gray-300">{FIELD_TYPE_ICONS[field.type]}</span>
        <span className="font-medium truncate dark:text-gray-100">{field.title}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0">
          {FIELD_TYPE_LABELS[field.type]}
        </span>
        {field.scope && field.scope !== 'board' && (
          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 flex items-center gap-1 ${
            field.scope === 'workspace' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
          }`}>
            {SCOPE_ICONS[field.scope]}
            {SCOPE_LABELS[field.scope]}
          </span>
        )}
        {field.required && (
          <span className="text-xs text-red-500 flex-shrink-0">Required</span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onEdit(field)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Edit"
        >
          <Edit2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        </button>
        <button
          onClick={() => onDelete(field)}
          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </div>
  );
}

// Static field item for drag overlay
function FieldItemOverlay({ field }: { field: CustomFieldDefinition }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-2 ring-blue-500 border dark:border-gray-700">
      <GripVertical className="h-4 w-4 text-gray-400" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="dark:text-gray-300">{FIELD_TYPE_ICONS[field.type]}</span>
        <span className="font-medium truncate dark:text-gray-100">{field.title}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
          {FIELD_TYPE_LABELS[field.type]}
        </span>
      </div>
    </div>
  );
}

// Droppable section component
interface DroppableSectionProps {
  id: CustomFieldDisplayLocation;
  title: string;
  icon: React.ReactNode;
  fields: CustomFieldDefinition[];
  onEdit: (field: CustomFieldDefinition) => void;
  onDelete: (field: CustomFieldDefinition) => void;
  isOver?: boolean;
}

function DroppableSection({ id, title, icon, fields, onEdit, onDelete, isOver }: DroppableSectionProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 rounded-lg border-2 border-dashed transition-colors ${
        isOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-200">{title}</h4>
        <span className="text-xs text-gray-500 dark:text-gray-400">({fields.length})</span>
      </div>
      <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {fields.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
              Drag fields here
            </p>
          ) : (
            fields.map((field) => (
              <SortableFieldItem
                key={field.id}
                field={field}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function CustomFieldsManager({ boardId, workspaceId, isOpen, onClose, onFieldsChange }: CustomFieldsManagerProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

  // New field form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>([]);
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [newFieldDisplayLocation, setNewFieldDisplayLocation] = useState<CustomFieldDisplayLocation>('main');
  const [newFieldScope, setNewFieldScope] = useState<CustomFieldScope>('board');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CustomFieldType>('text');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editRequired, setEditRequired] = useState(false);
  const [editOptionInput, setEditOptionInput] = useState('');
  const [editDisplayLocation, setEditDisplayLocation] = useState<CustomFieldDisplayLocation>('main');
  const [editScope, setEditScope] = useState<CustomFieldScope>('board');

  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overSectionId, setOverSectionId] = useState<CustomFieldDisplayLocation | null>(null);

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

  // Split fields by display location
  const mainFields = useMemo(
    () => fields.filter(f => f.displayLocation === 'main' || !f.displayLocation).sort((a, b) => a.position - b.position),
    [fields]
  );
  const sidebarFields = useMemo(
    () => fields.filter(f => f.displayLocation === 'sidebar').sort((a, b) => a.position - b.position),
    [fields]
  );

  const activeField = useMemo(
    () => fields.find(f => f.id === activeId),
    [fields, activeId]
  );

  useEffect(() => {
    if (isOpen && boardId) {
      loadFields();
    }
  }, [isOpen, boardId]);

  const loadFields = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCustomFieldsByBoard(boardId);
      setFields(data);
    } catch (error) {
      console.error('Failed to load custom fields:', error);
      toast.error('Failed to load custom fields');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateField = async () => {
    if (!newFieldName.trim()) {
      toast.error('Field name is required');
      return;
    }

    if (newFieldType === 'dropdown' && newFieldOptions.length === 0) {
      toast.error('Dropdown fields require at least one option');
      return;
    }

    setIsCreating(true);
    try {
      const data: CreateCustomFieldData = {
        title: newFieldName.trim(),
        boardId,
        workspaceId: newFieldScope === 'workspace' ? workspaceId : undefined,
        type: newFieldType,
        options: newFieldType === 'dropdown' ? newFieldOptions : undefined,
        required: newFieldRequired,
        position: fields.length,
        displayLocation: newFieldDisplayLocation,
        scope: newFieldScope,
      };

      const newField = await createCustomField(data);
      const updatedFields = [...fields, newField];
      setFields(updatedFields);
      onFieldsChange?.(updatedFields);
      toast.success(`Custom field "${newFieldName}" created`);

      // Reset form
      setShowNewForm(false);
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldOptions([]);
      setNewFieldRequired(false);
      setNewFieldDisplayLocation('main');
      setNewFieldScope('board');
    } catch (error) {
      console.error('Failed to create custom field:', error);
      toast.error('Failed to create custom field');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setEditName(field.title);
    setEditType(field.type);
    setEditOptions(field.options || []);
    setEditRequired(field.required);
    setEditDisplayLocation(field.displayLocation || 'main');
    setEditScope(field.scope || 'board');
  };

  const handleSaveEdit = async () => {
    if (!editingField) return;
    if (!editName.trim()) {
      toast.error('Field name is required');
      return;
    }

    if (editType === 'dropdown' && editOptions.length === 0) {
      toast.error('Dropdown fields require at least one option');
      return;
    }

    try {
      const updated = await updateCustomField(editingField.id, {
        title: editName.trim(),
        type: editType,
        options: editType === 'dropdown' ? editOptions : undefined,
        required: editRequired,
        displayLocation: editDisplayLocation,
        scope: editScope,
      });

      const updatedFields = fields.map((f) => (f.id === editingField.id ? updated : f));
      setFields(updatedFields);
      onFieldsChange?.(updatedFields);
      toast.success(`Custom field "${editName}" updated`);
      setEditingField(null);
    } catch (error) {
      console.error('Failed to update custom field:', error);
      toast.error('Failed to update custom field');
    }
  };

  const handleDeleteField = async (field: CustomFieldDefinition) => {
    const confirmed = await confirm({
      title: 'Delete Custom Field',
      message: `Are you sure you want to delete the custom field "${field.title}"? This will remove all values from cards. This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteCustomField(field.id);
      const updatedFields = fields.filter((f) => f.id !== field.id);
      setFields(updatedFields);
      onFieldsChange?.(updatedFields);
      toast.success(`Custom field "${field.title}" deleted`);
    } catch (error) {
      console.error('Failed to delete custom field:', error);
      toast.error('Failed to delete custom field');
    }
  };

  const addNewOption = () => {
    if (newOptionInput.trim() && !newFieldOptions.includes(newOptionInput.trim())) {
      setNewFieldOptions([...newFieldOptions, newOptionInput.trim()]);
      setNewOptionInput('');
    }
  };

  const removeNewOption = (option: string) => {
    setNewFieldOptions(newFieldOptions.filter((o) => o !== option));
  };

  const addEditOption = () => {
    if (editOptionInput.trim() && !editOptions.includes(editOptionInput.trim())) {
      setEditOptions([...editOptions, editOptionInput.trim()]);
      setEditOptionInput('');
    }
  };

  const removeEditOption = (option: string) => {
    setEditOptions(editOptions.filter((o) => o !== option));
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverSectionId(null);
      return;
    }

    // Check if over a section directly
    if (over.id === 'main' || over.id === 'sidebar') {
      setOverSectionId(over.id as CustomFieldDisplayLocation);
      return;
    }

    // Check if over a field - find which section it belongs to
    const overField = fields.find(f => f.id === over.id);
    if (overField) {
      const section = overField.displayLocation === 'sidebar' ? 'sidebar' : 'main';
      setOverSectionId(section);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverSectionId(null);

    if (!over) return;

    const activeField = fields.find(f => f.id === active.id);
    if (!activeField) return;

    // Determine the target section
    let targetSection: CustomFieldDisplayLocation;
    let targetIndex: number;

    if (over.id === 'main' || over.id === 'sidebar') {
      // Dropped on a section directly (empty area)
      targetSection = over.id as CustomFieldDisplayLocation;
      targetIndex = targetSection === 'main' ? mainFields.length : sidebarFields.length;
    } else {
      // Dropped on another field
      const overField = fields.find(f => f.id === over.id);
      if (!overField) return;

      targetSection = overField.displayLocation === 'sidebar' ? 'sidebar' : 'main';
      const targetList = targetSection === 'main' ? mainFields : sidebarFields;
      targetIndex = targetList.findIndex(f => f.id === over.id);
    }

    const currentSection = activeField.displayLocation === 'sidebar' ? 'sidebar' : 'main';

    // If moving within the same section
    if (currentSection === targetSection) {
      const currentList = targetSection === 'main' ? mainFields : sidebarFields;
      const oldIndex = currentList.findIndex(f => f.id === active.id);

      if (oldIndex !== targetIndex && oldIndex !== -1) {
        const newList = arrayMove(currentList, oldIndex, targetIndex);

        // Update positions locally first for instant feedback
        const updatedFields = fields.map(f => {
          const newIndex = newList.findIndex(nf => nf.id === f.id);
          if (newIndex !== -1) {
            return { ...f, position: newIndex };
          }
          return f;
        });
        setFields(updatedFields);
        onFieldsChange?.(updatedFields);

        // Persist to backend
        try {
          await updateCustomField(activeField.id, { position: targetIndex });
        } catch (error) {
          console.error('Failed to update field position:', error);
          toast.error('Failed to reorder field');
          loadFields(); // Reload to restore correct state
        }
      }
    } else {
      // Moving to a different section
      const newDisplayLocation = targetSection;

      // Update locally first
      const updatedFields = fields.map(f => {
        if (f.id === activeField.id) {
          return { ...f, displayLocation: newDisplayLocation, position: targetIndex };
        }
        return f;
      });
      setFields(updatedFields);
      onFieldsChange?.(updatedFields);

      // Persist to backend
      try {
        await updateCustomField(activeField.id, {
          displayLocation: newDisplayLocation,
          position: targetIndex,
        });
        toast.success(`Moved "${activeField.title}" to ${newDisplayLocation === 'main' ? 'Main Content' : 'Sidebar'}`);
      } catch (error) {
        console.error('Failed to move field:', error);
        toast.error('Failed to move field');
        loadFields(); // Reload to restore correct state
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-semibold dark:text-gray-100">Custom Fields</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors dark:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Drag and Drop Fields */}
              {fields.length === 0 && !showNewForm ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No custom fields yet. Create one to add extra data to cards.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      Drag fields between sections to change where they appear on cards
                    </p>

                    {/* Main Content Section */}
                    <DroppableSection
                      id="main"
                      title="Main Content"
                      icon={<PanelLeft className="h-4 w-4 text-blue-600" />}
                      fields={mainFields}
                      onEdit={handleStartEdit}
                      onDelete={handleDeleteField}
                      isOver={overSectionId === 'main'}
                    />

                    {/* Sidebar Section */}
                    <DroppableSection
                      id="sidebar"
                      title="Sidebar"
                      icon={<PanelRight className="h-4 w-4 text-purple-600" />}
                      fields={sidebarFields}
                      onEdit={handleStartEdit}
                      onDelete={handleDeleteField}
                      isOver={overSectionId === 'sidebar'}
                    />
                  </div>

                  {/* Drag overlay */}
                  <DragOverlay>
                    {activeField ? <FieldItemOverlay field={activeField} /> : null}
                  </DragOverlay>
                </DndContext>
              )}

              {/* Edit Field Form */}
              {editingField && (
                <div className="p-4 border dark:border-gray-600 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <h3 className="font-medium mb-3 dark:text-gray-100">Edit Field</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-gray-200">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Field name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-gray-200">Type</label>
                      <Select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as CustomFieldType)}
                        options={Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                      />
                    </div>

                    {editType === 'dropdown' && (
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-200">Options</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {editOptions.map((option) => (
                            <span
                              key={option}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm dark:text-gray-200"
                            >
                              {option}
                              <button
                                onClick={() => removeEditOption(option)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editOptionInput}
                            onChange={(e) => setEditOptionInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEditOption())}
                            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add option"
                          />
                          <button
                            onClick={addEditOption}
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors dark:text-gray-200"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-200">Display Location</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditDisplayLocation('main')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                            editDisplayLocation === 'main'
                              ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-500 text-blue-700 dark:text-blue-300'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          <PanelLeft className="h-4 w-4" />
                          Main Content
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditDisplayLocation('sidebar')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                            editDisplayLocation === 'sidebar'
                              ? 'bg-purple-50 dark:bg-purple-900/50 border-purple-500 text-purple-700 dark:text-purple-300'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          <PanelRight className="h-4 w-4" />
                          Sidebar
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-200">Scope</label>
                      <div className="flex gap-2">
                        {(['board', 'workspace', 'card'] as CustomFieldScope[]).map((scope) => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => setEditScope(scope)}
                            disabled={scope === 'workspace' && !workspaceId}
                            className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-md border transition-colors ${
                              editScope === scope
                                ? scope === 'workspace'
                                  ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-500 text-blue-700 dark:text-blue-300'
                                  : scope === 'card'
                                  ? 'bg-purple-50 dark:bg-purple-900/50 border-purple-500 text-purple-700 dark:text-purple-300'
                                  : 'bg-green-50 dark:bg-green-900/50 border-green-500 text-green-700 dark:text-green-300'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                          >
                            {SCOPE_ICONS[scope]}
                            <span className="text-xs">{SCOPE_LABELS[scope]}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{SCOPE_DESCRIPTIONS[editScope]}</p>
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editRequired}
                        onChange={(e) => setEditRequired(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500 dark:bg-gray-700"
                      />
                      <span className="text-sm dark:text-gray-200">Required field</span>
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* New Field Form */}
              {showNewForm && !editingField && (
                <div className="p-4 border dark:border-gray-600 rounded-lg bg-green-50 dark:bg-green-900/30">
                  <h3 className="font-medium mb-3 dark:text-gray-100">New Custom Field</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-gray-200">Name</label>
                      <input
                        type="text"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Priority, Story Points, Sprint"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-gray-200">Type</label>
                      <Select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                        options={Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                      />
                    </div>

                    {newFieldType === 'dropdown' && (
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-200">Options</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {newFieldOptions.map((option) => (
                            <span
                              key={option}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm dark:text-gray-200"
                            >
                              {option}
                              <button
                                onClick={() => removeNewOption(option)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newOptionInput}
                            onChange={(e) => setNewOptionInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewOption())}
                            className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add option"
                          />
                          <button
                            onClick={addNewOption}
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors dark:text-gray-200"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-200">Display Location</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewFieldDisplayLocation('main')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                            newFieldDisplayLocation === 'main'
                              ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-500 text-blue-700 dark:text-blue-300'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          <PanelLeft className="h-4 w-4" />
                          Main Content
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewFieldDisplayLocation('sidebar')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                            newFieldDisplayLocation === 'sidebar'
                              ? 'bg-purple-50 dark:bg-purple-900/50 border-purple-500 text-purple-700 dark:text-purple-300'
                              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          <PanelRight className="h-4 w-4" />
                          Sidebar
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-gray-200">Scope</label>
                      <div className="flex gap-2">
                        {(['board', 'workspace', 'card'] as CustomFieldScope[]).map((scope) => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => setNewFieldScope(scope)}
                            disabled={scope === 'workspace' && !workspaceId}
                            className={`flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-md border transition-colors ${
                              newFieldScope === scope
                                ? scope === 'workspace'
                                  ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-500 text-blue-700 dark:text-blue-300'
                                  : scope === 'card'
                                  ? 'bg-purple-50 dark:bg-purple-900/50 border-purple-500 text-purple-700 dark:text-purple-300'
                                  : 'bg-green-50 dark:bg-green-900/50 border-green-500 text-green-700 dark:text-green-300'
                                : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                          >
                            {SCOPE_ICONS[scope]}
                            <span className="text-xs">{SCOPE_LABELS[scope]}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{SCOPE_DESCRIPTIONS[newFieldScope]}</p>
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newFieldRequired}
                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500 dark:bg-gray-700"
                      />
                      <span className="text-sm dark:text-gray-200">Required field</span>
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowNewForm(false);
                          setNewFieldName('');
                          setNewFieldType('text');
                          setNewFieldOptions([]);
                          setNewFieldRequired(false);
                          setNewFieldDisplayLocation('main');
                          setNewFieldScope('board');
                        }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateField}
                        disabled={isCreating}
                        className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700">
          {!showNewForm && !editingField && (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Custom Field
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}

export default CustomFieldsManager;
