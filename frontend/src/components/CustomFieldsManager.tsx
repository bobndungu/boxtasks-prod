import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  GripVertical,
  Loader2,
  ChevronDown,
  Settings,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
} from 'lucide-react';
import {
  fetchCustomFieldsByBoard,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  type CustomFieldDefinition,
  type CustomFieldType,
  type CreateCustomFieldData,
} from '../lib/api/customFields';
import { toast } from '../lib/stores/toast';

interface CustomFieldsManagerProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

const FIELD_TYPE_ICONS: Record<CustomFieldType, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  dropdown: <List className="h-4 w-4" />,
  checkbox: <CheckSquare className="h-4 w-4" />,
};

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
};

export function CustomFieldsManager({ boardId, isOpen, onClose }: CustomFieldsManagerProps) {
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

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<CustomFieldType>('text');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editRequired, setEditRequired] = useState(false);
  const [editOptionInput, setEditOptionInput] = useState('');

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
        type: newFieldType,
        options: newFieldType === 'dropdown' ? newFieldOptions : undefined,
        required: newFieldRequired,
        position: fields.length,
      };

      const newField = await createCustomField(data);
      setFields([...fields, newField]);
      toast.success(`Custom field "${newFieldName}" created`);

      // Reset form
      setShowNewForm(false);
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldOptions([]);
      setNewFieldRequired(false);
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
      });

      setFields(fields.map((f) => (f.id === editingField.id ? updated : f)));
      toast.success(`Custom field "${editName}" updated`);
      setEditingField(null);
    } catch (error) {
      console.error('Failed to update custom field:', error);
      toast.error('Failed to update custom field');
    }
  };

  const handleDeleteField = async (field: CustomFieldDefinition) => {
    if (!confirm(`Delete custom field "${field.title}"? This will remove all values from cards.`)) {
      return;
    }

    try {
      await deleteCustomField(field.id);
      setFields(fields.filter((f) => f.id !== field.id));
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Custom Fields</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
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
              {/* Existing Fields */}
              {fields.length === 0 && !showNewForm ? (
                <p className="text-gray-500 text-center py-4">
                  No custom fields yet. Create one to add extra data to cards.
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
                    >
                      <GripVertical className="h-4 w-4 text-gray-300" />
                      <div className="flex items-center gap-2 flex-1">
                        {FIELD_TYPE_ICONS[field.type]}
                        <span className="font-medium">{field.title}</span>
                        <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-200 rounded">
                          {FIELD_TYPE_LABELS[field.type]}
                        </span>
                        {field.required && (
                          <span className="text-xs text-red-500">Required</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEdit(field)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteField(field)}
                          className="p-1 hover:bg-red-100 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Edit Field Form */}
              {editingField && (
                <div className="p-4 border rounded-lg bg-blue-50">
                  <h3 className="font-medium mb-3">Edit Field</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Field name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <div className="relative">
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as CustomFieldType)}
                          className="w-full px-3 py-2 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {editType === 'dropdown' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Options</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {editOptions.map((option) => (
                            <span
                              key={option}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded text-sm"
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
                            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add option"
                          />
                          <button
                            onClick={addEditOption}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editRequired}
                        onChange={(e) => setEditRequired(e.target.checked)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm">Required field</span>
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingField(null)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
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
                <div className="p-4 border rounded-lg bg-green-50">
                  <h3 className="font-medium mb-3">New Custom Field</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Priority, Story Points, Sprint"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Type</label>
                      <div className="relative">
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                          className="w-full px-3 py-2 border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {newFieldType === 'dropdown' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Options</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {newFieldOptions.map((option) => (
                            <span
                              key={option}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white border rounded text-sm"
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
                            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add option"
                          />
                          <button
                            onClick={addNewOption}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newFieldRequired}
                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm">Required field</span>
                    </label>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowNewForm(false);
                          setNewFieldName('');
                          setNewFieldType('text');
                          setNewFieldOptions([]);
                          setNewFieldRequired(false);
                        }}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
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
        <div className="p-4 border-t">
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
    </div>
  );
}

export default CustomFieldsManager;
