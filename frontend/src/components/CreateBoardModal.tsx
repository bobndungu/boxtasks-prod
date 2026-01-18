import { useState, useEffect } from 'react';
import { Loader2, Lock, Users, Globe, X, Check, ChevronDown, UserPlus } from 'lucide-react';
import { createBoard, type Board, type CreateBoardData } from '../lib/api/boards';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { fetchWorkspaceMembers, type WorkspaceMember } from '../lib/api/workspaces';
import { fetchWorkspaceRoles, fetchWorkspaceMemberRoles, type WorkspaceRole } from '../lib/api/roles';

const BOARD_BACKGROUNDS = [
  '#0079BF', '#D29034', '#519839', '#B04632', '#89609E',
  '#CD5A91', '#4BBF6B', '#00AECC', '#838C91', '#172B4D',
];

type MemberSetupOption = 'inherit' | 'just_me' | 'custom';

interface MemberWithRole {
  member: WorkspaceMember;
  roleId: string;
  selected: boolean;
}

interface CreateBoardModalProps {
  workspaceId?: string;
  onClose: () => void;
  onCreate: (board: Board) => void;
}

export default function CreateBoardModal({
  workspaceId,
  onClose,
  onCreate,
}: CreateBoardModalProps) {
  const { workspaces } = useWorkspaceStore();
  // Initialize with workspaceId prop, or first workspace if available
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() => {
    if (workspaceId) return workspaceId;
    if (workspaces.length > 0) return workspaces[0].id;
    return '';
  });
  const [formData, setFormData] = useState<Omit<CreateBoardData, 'workspaceId'>>({
    title: '',
    description: '',
    visibility: 'workspace',
    background: BOARD_BACKGROUNDS[0],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Member setup state
  const [memberSetup, setMemberSetup] = useState<MemberSetupOption>('inherit');
  const [workspaceMembers, setWorkspaceMembers] = useState<MemberWithRole[]>([]);
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);

  // Load workspace members and roles when workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) {
      setWorkspaceMembers([]);
      setRoles([]);
      return;
    }

    const loadMembersAndRoles = async () => {
      setLoadingMembers(true);
      try {
        const [members, availableRoles, existingMemberRoles] = await Promise.all([
          fetchWorkspaceMembers(selectedWorkspaceId),
          fetchWorkspaceRoles(selectedWorkspaceId),
          fetchWorkspaceMemberRoles(selectedWorkspaceId),
        ]);

        setRoles(availableRoles);

        // Find default role
        const defaultRole = availableRoles.find(r => r.isDefault) || availableRoles[0];
        const defaultRoleId = defaultRole?.id || '';

        // Map members with their current workspace roles
        const membersWithRoles: MemberWithRole[] = members.map(member => {
          const memberRole = existingMemberRoles.find(mr => mr.userId === member.id);
          return {
            member,
            roleId: memberRole?.roleId || defaultRoleId,
            selected: true, // Default to selected
          };
        });

        setWorkspaceMembers(membersWithRoles);
      } catch (err) {
        console.error('Failed to load members:', err);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembersAndRoles();
  }, [selectedWorkspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Board title is required');
      return;
    }
    if (!selectedWorkspaceId) {
      setError('Please select a workspace');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Determine which members to include based on setup option
      let selectedMembers: { userId: string; roleId: string }[] = [];

      if (memberSetup === 'inherit') {
        // Include all workspace members with their roles
        selectedMembers = workspaceMembers.map(m => ({
          userId: m.member.id,
          roleId: m.roleId,
        }));
      } else if (memberSetup === 'custom') {
        // Include only selected members
        selectedMembers = workspaceMembers
          .filter(m => m.selected)
          .map(m => ({
            userId: m.member.id,
            roleId: m.roleId,
          }));
      }
      // For 'just_me', selectedMembers stays empty (creator is added automatically)

      const board = await createBoard({
        ...formData,
        workspaceId: selectedWorkspaceId,
        // Pass member setup info (we'll extend CreateBoardData if needed)
        memberSetup,
        members: selectedMembers,
      } as CreateBoardData & { memberSetup: string; members: { userId: string; roleId: string }[] });

      onCreate(board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board');
      setIsCreating(false);
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setWorkspaceMembers(prev =>
      prev.map(m =>
        m.member.id === memberId ? { ...m, selected: !m.selected } : m
      )
    );
  };

  const updateMemberRole = (memberId: string, roleId: string) => {
    setWorkspaceMembers(prev =>
      prev.map(m =>
        m.member.id === memberId ? { ...m, roleId } : m
      )
    );
  };

  const selectAllMembers = () => {
    setWorkspaceMembers(prev => prev.map(m => ({ ...m, selected: true })));
  };

  const deselectAllMembers = () => {
    setWorkspaceMembers(prev => prev.map(m => ({ ...m, selected: false })));
  };

  const selectedCount = workspaceMembers.filter(m => m.selected).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Board</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Preview */}
            <div
              className="h-24 rounded-lg flex items-end p-3"
              style={{ backgroundColor: formData.background }}
            >
              <span className="font-semibold text-white truncate">
                {formData.title || 'Board title'}
              </span>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Workspace Selector (only show if no workspaceId prop) */}
            {!workspaceId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workspace
                </label>
                <select
                  value={selectedWorkspaceId}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a workspace</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Board Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter board title"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Background
              </label>
              <div className="flex flex-wrap gap-2">
                {BOARD_BACKGROUNDS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, background: color })}
                    className={`w-10 h-8 rounded transition-transform ${
                      formData.background === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Visibility
              </label>
              <div className="space-y-2">
                {[
                  { value: 'private', label: 'Private', desc: 'Only you can see', icon: Lock },
                  { value: 'workspace', label: 'Workspace', desc: 'All workspace members', icon: Users },
                  { value: 'public', label: 'Public', desc: 'Anyone with link', icon: Globe },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.visibility === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={formData.visibility === option.value}
                      onChange={(e) =>
                        setFormData({ ...formData, visibility: e.target.value as 'private' | 'workspace' | 'public' })
                      }
                      className="sr-only"
                    />
                    <option.icon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Member Setup Section */}
            {selectedWorkspaceId && formData.visibility !== 'private' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <UserPlus className="h-4 w-4 inline mr-1" />
                  Member Setup
                </label>
                <div className="space-y-2">
                  {[
                    {
                      value: 'inherit',
                      label: 'Inherit from workspace',
                      desc: `All ${workspaceMembers.length} workspace members with their roles`,
                    },
                    {
                      value: 'just_me',
                      label: 'Start with just me',
                      desc: 'Only you as the board creator',
                    },
                    {
                      value: 'custom',
                      label: 'Choose members',
                      desc: 'Select specific members and assign roles',
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        memberSetup === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="memberSetup"
                        value={option.value}
                        checked={memberSetup === option.value}
                        onChange={(e) => {
                          setMemberSetup(e.target.value as MemberSetupOption);
                          if (e.target.value === 'custom') {
                            setShowMemberList(true);
                          }
                        }}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center flex-shrink-0 ${
                          memberSetup === option.value
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-500'
                        }`}
                      >
                        {memberSetup === option.value && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Custom Member Selection */}
                {memberSetup === 'custom' && (
                  <div className="mt-4 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowMemberList(!showMemberList)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between text-left"
                    >
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {selectedCount} of {workspaceMembers.length} members selected
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-gray-500 transition-transform ${
                          showMemberList ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showMemberList && (
                      <div className="p-2 border-t border-gray-200 dark:border-gray-600">
                        {/* Quick actions */}
                        <div className="flex gap-2 mb-2 px-2">
                          <button
                            type="button"
                            onClick={selectAllMembers}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Select all
                          </button>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <button
                            type="button"
                            onClick={deselectAllMembers}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Deselect all
                          </button>
                        </div>

                        {loadingMembers ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                          </div>
                        ) : workspaceMembers.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            No members in this workspace
                          </p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {workspaceMembers.map((item) => (
                              <div
                                key={item.member.id}
                                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                                  item.selected
                                    ? 'bg-blue-50 dark:bg-blue-900/20'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleMemberSelection(item.member.id)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                    item.selected
                                      ? 'border-blue-500 bg-blue-500'
                                      : 'border-gray-300 dark:border-gray-500'
                                  }`}
                                >
                                  {item.selected && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                      {item.member.displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {item.member.displayName}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {item.member.email}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <select
                                  value={item.roleId}
                                  onChange={(e) => updateMemberRole(item.member.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={!item.selected}
                                  className={`text-xs px-2 py-1 rounded border bg-white dark:bg-gray-700 ${
                                    item.selected
                                      ? 'border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300'
                                      : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                                  }`}
                                >
                                  {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                      {role.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !selectedWorkspaceId}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Board
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
