import { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2, Edit2, Check, FolderOpen, Users } from 'lucide-react';
import {
  fetchFieldGroups,
  createFieldGroup,
  updateFieldGroup,
  deleteFieldGroup,
  type CreateFieldGroupData,
} from '../lib/api/fieldGroups';
import { fetchWorkspaceRoles, type WorkspaceRole } from '../lib/api/roles';
import type { CustomFieldGroup } from '../lib/api/customFields';
import { toast } from '../lib/stores/toast';

interface FieldGroupsManagerProps {
  boardId: string;
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onGroupsChange?: (groups: CustomFieldGroup[]) => void;
}

export function FieldGroupsManager({
  boardId,
  workspaceId,
  isOpen,
  onClose,
  onGroupsChange,
}: FieldGroupsManagerProps) {
  const [groups, setGroups] = useState<CustomFieldGroup[]>([]);
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New group form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newGroupRoleIds, setNewGroupRoleIds] = useState<string[]>([]);

  // Edit state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  // Load groups and roles
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [fetchedGroups, fetchedRoles] = await Promise.all([
          fetchFieldGroups(boardId),
          fetchWorkspaceRoles(workspaceId).catch(() => []),
        ]);
        setGroups(fetchedGroups);
        setRoles(fetchedRoles);
      } catch (err) {
        console.error('Failed to load field groups:', err);
        toast.error('Failed to load field groups');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, boardId, workspaceId]);

  const handleCreateGroup = async () => {
    if (!newGroupTitle.trim()) {
      toast.error('Group title is required');
      return;
    }

    setIsCreating(true);
    try {
      const data: CreateFieldGroupData = {
        title: newGroupTitle.trim(),
        boardId,
        workspaceId,
        roleIds: newGroupRoleIds.length > 0 ? newGroupRoleIds : undefined,
        position: groups.length,
      };

      const newGroup = await createFieldGroup(data);
      const updatedGroups = [...groups, newGroup];
      setGroups(updatedGroups);
      onGroupsChange?.(updatedGroups);

      // Reset form
      setNewGroupTitle('');
      setNewGroupRoleIds([]);
      setShowNewForm(false);
      toast.success('Field group created');
    } catch (err) {
      console.error('Failed to create field group:', err);
      toast.error('Failed to create field group');
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (group: CustomFieldGroup) => {
    setEditingGroupId(group.id);
    setEditTitle(group.title);
    setEditRoleIds(group.roleIds);
  };

  const cancelEditing = () => {
    setEditingGroupId(null);
    setEditTitle('');
    setEditRoleIds([]);
  };

  const handleUpdateGroup = async (groupId: string) => {
    if (!editTitle.trim()) {
      toast.error('Group title is required');
      return;
    }

    setIsSaving(true);
    try {
      const updatedGroup = await updateFieldGroup(groupId, {
        title: editTitle.trim(),
        roleIds: editRoleIds,
      });

      const updatedGroups = groups.map(g => g.id === groupId ? updatedGroup : g);
      setGroups(updatedGroups);
      onGroupsChange?.(updatedGroups);

      cancelEditing();
      toast.success('Field group updated');
    } catch (err) {
      console.error('Failed to update field group:', err);
      toast.error('Failed to update field group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this field group? Fields in this group will become ungrouped.')) {
      return;
    }

    try {
      await deleteFieldGroup(groupId);
      const updatedGroups = groups.filter(g => g.id !== groupId);
      setGroups(updatedGroups);
      onGroupsChange?.(updatedGroups);
      toast.success('Field group deleted');
    } catch (err) {
      console.error('Failed to delete field group:', err);
      toast.error('Failed to delete field group');
    }
  };

  const toggleRole = (roleId: string, isNew: boolean) => {
    if (isNew) {
      setNewGroupRoleIds(prev =>
        prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
      );
    } else {
      setEditRoleIds(prev =>
        prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Field Groups</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Groups List */}
              {groups.length > 0 ? (
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                    >
                      {editingGroupId === group.id ? (
                        // Edit mode
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            placeholder="Group title"
                            autoFocus
                          />

                          {/* Role selection */}
                          {roles.length > 0 && (
                            <div>
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                                Visible to roles (empty = all roles)
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {roles.map((role) => (
                                  <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.id, false)}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                      editRoleIds.includes(role.id)
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {role.title}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateGroup(group.id)}
                              disabled={isSaving}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {group.title}
                            </h4>
                            {group.roleIds.length > 0 ? (
                              <div className="flex items-center gap-1 mt-1">
                                <Users className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {group.roleIds.length} role{group.roleIds.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Visible to all roles</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              type="button"
                              onClick={() => startEditing(group)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Edit group"
                            >
                              <Edit2 className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(group.id)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Delete group"
                            >
                              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !showNewForm ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
                  No field groups yet. Create a group to organize your custom fields.
                </p>
              ) : null}

              {/* New Group Form */}
              {showNewForm && (
                <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-3">
                    New Field Group
                  </h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newGroupTitle}
                      onChange={(e) => setNewGroupTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder="Group title"
                      autoFocus
                    />

                    {/* Role selection */}
                    {roles.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                          Visible to roles (empty = all roles)
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {roles.map((role) => (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => toggleRole(role.id, true)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                newGroupRoleIds.includes(role.id)
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {role.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewForm(false);
                          setNewGroupTitle('');
                          setNewGroupRoleIds([]);
                        }}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateGroup}
                        disabled={isCreating || !newGroupTitle.trim()}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        {isCreating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          {!showNewForm && !editingGroupId && (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Field Group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
