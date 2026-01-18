import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Users, ExternalLink, UserCircle } from 'lucide-react';
import { fetchWorkspaceMembers, fetchAllUsers, updateWorkspaceMembers, type WorkspaceMember } from '../lib/api/workspaces';
import { updateBoardMembers, updateBoardAdmins, type BoardMember } from '../lib/api/boards';
import { fetchWorkspaceRoles, fetchWorkspaceMemberRoles, createMemberRole, updateMemberRole as updateMemberRoleAPI, type WorkspaceRole, type MemberRoleAssignment } from '../lib/api/roles';
import { toast } from '../lib/stores/toast';
import { Link } from 'react-router-dom';
import MemberDropdown from './MemberDropdown';

// System users that should not appear in member dropdowns
const SYSTEM_USER_NAMES = ['n8n_api', 'n8n api', 'boxraft admin'];

// Filter out system users from a member list
const filterSystemUsers = <T extends { displayName: string }>(users: T[]): T[] =>
  users.filter(u => !SYSTEM_USER_NAMES.includes(u.displayName.toLowerCase()));

interface BoardMembersModalProps {
  boardId: string;
  workspaceId: string;
  onClose: () => void;
  boardMembers?: BoardMember[];
  memberSetup?: 'inherit' | 'just_me' | 'custom';
  onMembersChange?: (members: BoardMember[]) => void;
  onRefresh?: () => void; // Callback to refresh board data after changes
}

export default function BoardMembersModal({
  boardId,
  workspaceId,
  onClose,
  boardMembers = [],
  memberSetup = 'inherit',
  onMembersChange,
  onRefresh,
}: BoardMembersModalProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [allUsers, setAllUsers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  // Roles from the workspace
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [memberRoles, setMemberRoles] = useState<MemberRoleAssignment[]>([]);
  // State for role selection when adding a member
  const [pendingMember, setPendingMember] = useState<WorkspaceMember | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  // Track if we've loaded initial data to avoid re-triggering on prop changes
  const hasLoadedRef = useRef(false);

  // Determine if we're showing board-specific members or workspace members
  const isBoardSpecific = memberSetup === 'custom';
  const isJustMe = memberSetup === 'just_me';

  // Load members only once on mount, not on every prop change
  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadMembers();
      hasLoadedRef.current = true;
    }
  }, [workspaceId, memberSetup]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      // Always fetch roles for the workspace
      const [rolesData, memberRolesData] = await Promise.all([
        fetchWorkspaceRoles(workspaceId),
        fetchWorkspaceMemberRoles(workspaceId),
      ]);
      setRoles(rolesData);
      setMemberRoles(memberRolesData);

      // Set default role for adding new members
      const defaultRole = rolesData.find(r => r.isDefault) || rolesData[0];
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
      }

      if ((isBoardSpecific || isJustMe) && boardMembers.length > 0) {
        // Use board-specific members passed from props
        const convertedMembers: WorkspaceMember[] = boardMembers.map(m => ({
          id: m.id,
          displayName: m.displayName,
          email: m.email,
          isAdmin: m.isAdmin || false, // Preserve admin status from API
        }));
        setMembers(filterSystemUsers(convertedMembers));
        // Load all users for adding new members (only for custom setup)
        if (isBoardSpecific) {
          const userData = await fetchAllUsers();
          // Filter out system users from the dropdown
          setAllUsers(filterSystemUsers(userData));
        }
      } else {
        // Load from workspace
        const [memberData, userData] = await Promise.all([
          fetchWorkspaceMembers(workspaceId),
          fetchAllUsers(),
        ]);
        // Filter out system users from both lists
        setMembers(filterSystemUsers(memberData));
        setAllUsers(filterSystemUsers(userData));
      }
    } catch {
      toast.error('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  // Called when user selects a member from dropdown
  const handleMemberSelected = (user: WorkspaceMember) => {
    // For board-specific members, show role selection
    if (isBoardSpecific) {
      setPendingMember(user);
      // Set default role (find 'member' role or use first available)
      const defaultRole = roles.find(r => r.isDefault) || roles.find(r => r.title.toLowerCase() === 'member') || roles[0];
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
      }
    } else {
      // For workspace members, just add directly
      handleAddMember(user, false);
    }
  };

  // Cancel role selection
  const handleCancelRoleSelection = () => {
    setPendingMember(null);
    // Reset to default role
    const defaultRole = roles.find(r => r.isDefault) || roles[0];
    if (defaultRole) {
      setSelectedRoleId(defaultRole.id);
    }
  };

  // Get role for a member
  const getMemberRole = (userId: string): WorkspaceRole | undefined => {
    const assignment = memberRoles.find(mr => mr.userId === userId);
    if (assignment) {
      return roles.find(r => r.id === assignment.roleId);
    }
    // Return default role
    return roles.find(r => r.isDefault) || roles[0];
  };

  // Get member role assignment
  const getMemberRoleAssignment = (userId: string): MemberRoleAssignment | undefined => {
    return memberRoles.find(mr => mr.userId === userId);
  };

  // Confirm adding member with selected role
  const handleConfirmAddMember = () => {
    if (pendingMember && selectedRoleId) {
      // Find if selected role is admin (has full permissions)
      const selectedRole = roles.find(r => r.id === selectedRoleId);
      const isAdmin = selectedRole?.title.toLowerCase() === 'admin';
      handleAddMember(pendingMember, isAdmin, selectedRoleId);
      setPendingMember(null);
      // Reset to default role
      const defaultRole = roles.find(r => r.isDefault) || roles[0];
      if (defaultRole) {
        setSelectedRoleId(defaultRole.id);
      }
    }
  };

  const handleAddMember = async (user: WorkspaceMember, makeAdmin: boolean = false, roleId?: string) => {
    setIsUpdating(true);
    try {
      const newMembers = [...members, { ...user, isAdmin: makeAdmin }];
      const memberIds = newMembers.map(m => m.id);

      if (isBoardSpecific) {
        // Update board-specific members
        await updateBoardMembers(boardId, memberIds);

        // If making admin, also update board admins
        if (makeAdmin) {
          const newAdminIds = newMembers.filter(m => m.isAdmin).map(m => m.id);
          await updateBoardAdmins(boardId, newAdminIds);
        }

        // Create role assignment if roleId provided
        if (roleId) {
          try {
            const newAssignment = await createMemberRole(workspaceId, user.id, roleId);
            setMemberRoles(prev => [...prev, newAssignment]);
          } catch {
            // Role assignment might already exist, that's OK
          }
        }

        setMembers(newMembers);
        // Notify parent component
        if (onMembersChange) {
          onMembersChange(newMembers.map(m => ({
            id: m.id,
            displayName: m.displayName,
            email: m.email,
            drupal_id: 0, // Will be updated on next fetch
            isAdmin: m.isAdmin,
          })));
        }
        const roleName = roleId ? roles.find(r => r.id === roleId)?.title : (makeAdmin ? 'Admin' : 'Member');
        toast.success(`${user.displayName} added to board as ${roleName}`);
        // Refresh parent data to ensure consistency
        onRefresh?.();
      } else {
        // Update workspace members
        const adminIds = makeAdmin
          ? [...members.filter(m => m.isAdmin).map(m => m.id), user.id]
          : members.filter(m => m.isAdmin).map(m => m.id);
        await updateWorkspaceMembers(workspaceId, memberIds, adminIds);

        // Create role assignment if roleId provided
        if (roleId) {
          try {
            const newAssignment = await createMemberRole(workspaceId, user.id, roleId);
            setMemberRoles(prev => [...prev, newAssignment]);
          } catch {
            // Role assignment might already exist, that's OK
          }
        }

        setMembers(newMembers);
        const roleName = roleId ? roles.find(r => r.id === roleId)?.title : (makeAdmin ? 'Admin' : 'Member');
        toast.success(`${user.displayName} added to workspace as ${roleName}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const member = members.find(m => m.id === userId);
    if (!member) return;

    // Don't allow removing the last admin (workspace only)
    if (!isBoardSpecific && member.isAdmin && members.filter(m => m.isAdmin).length <= 1) {
      toast.error('Cannot remove the last admin');
      return;
    }

    // Don't allow removing the last member from a board
    if (isBoardSpecific && members.length <= 1) {
      toast.error('Cannot remove the last member from a board');
      return;
    }

    setIsUpdating(true);
    try {
      const remainingMembers = members.filter(m => m.id !== userId);
      const memberIds = remainingMembers.map(m => m.id);

      if (isBoardSpecific) {
        // Update board-specific members
        await updateBoardMembers(boardId, memberIds);
        setMembers(remainingMembers);
        // Notify parent component
        if (onMembersChange) {
          onMembersChange(remainingMembers.map(m => ({
            id: m.id,
            displayName: m.displayName,
            email: m.email,
            drupal_id: 0,
          })));
        }
        toast.success(`${member.displayName} removed from board`);
        // Refresh parent data to ensure consistency
        onRefresh?.();
      } else {
        // Update workspace members
        const adminIds = members.filter(m => m.isAdmin && m.id !== userId).map(m => m.id);
        await updateWorkspaceMembers(workspaceId, memberIds, adminIds);
        setMembers(remainingMembers);
        toast.success(`${member.displayName} removed from workspace`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangeRole = async (userId: string, newRoleId: string) => {
    const member = members.find(m => m.id === userId);
    if (!member) return;

    const newRole = roles.find(r => r.id === newRoleId);
    const currentRole = getMemberRole(userId);
    const currentAssignment = getMemberRoleAssignment(userId);

    if (!newRole) return;
    if (currentRole?.id === newRoleId) return; // No change

    // Check if we're changing from admin to non-admin
    const isCurrentlyAdmin = currentRole?.title.toLowerCase() === 'admin';
    const isNewRoleAdmin = newRole.title.toLowerCase() === 'admin';

    // Don't allow removing the last admin
    if (isCurrentlyAdmin && !isNewRoleAdmin) {
      const adminCount = members.filter(m => getMemberRole(m.id)?.title.toLowerCase() === 'admin').length;
      if (adminCount <= 1) {
        toast.error('Cannot remove the last admin');
        return;
      }
    }

    setIsUpdating(true);
    try {
      // Update the role assignment
      if (currentAssignment) {
        // Update existing assignment
        const updatedAssignment = await updateMemberRoleAPI(currentAssignment.id, newRoleId);
        setMemberRoles(prev =>
          prev.map(mr => mr.id === currentAssignment.id ? updatedAssignment : mr)
        );
      } else {
        // Create new assignment
        const newAssignment = await createMemberRole(workspaceId, userId, newRoleId);
        setMemberRoles(prev => [...prev, newAssignment]);
      }

      // Update local member state
      const updatedMembers = members.map(m =>
        m.id === userId ? { ...m, isAdmin: isNewRoleAdmin } : m
      );
      setMembers(updatedMembers);

      if (isBoardSpecific) {
        // Update board admins if admin status changed
        if (isCurrentlyAdmin !== isNewRoleAdmin) {
          const newAdminIds = updatedMembers.filter(m => {
            const role = getMemberRole(m.id);
            return m.id === userId ? isNewRoleAdmin : role?.title.toLowerCase() === 'admin';
          }).map(m => m.id);
          await updateBoardAdmins(boardId, newAdminIds);
        }

        // Notify parent component
        if (onMembersChange) {
          onMembersChange(updatedMembers.map(m => ({
            id: m.id,
            displayName: m.displayName,
            email: m.email,
            drupal_id: 0,
            isAdmin: m.id === userId ? isNewRoleAdmin : m.isAdmin,
          })));
        }
        // Refresh parent data to ensure consistency
        onRefresh?.();
      } else {
        // Update workspace admins if admin status changed
        if (isCurrentlyAdmin !== isNewRoleAdmin) {
          const memberIds = members.map(m => m.id);
          const adminIds = updatedMembers.filter(m => {
            const role = getMemberRole(m.id);
            return m.id === userId ? isNewRoleAdmin : role?.title.toLowerCase() === 'admin';
          }).map(m => m.id);
          await updateWorkspaceMembers(workspaceId, memberIds, adminIds);
        }
      }

      toast.success(`${member.displayName}'s role changed to ${newRole.title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update member role');
    } finally {
      setIsUpdating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-visible">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Board Members</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
              {memberSetup === 'just_me' && (
                <>
                  <UserCircle className="h-4 w-4" />
                  Only the board creator has access
                </>
              )}
              {memberSetup === 'custom' && (
                <>
                  <Users className="h-4 w-4" />
                  Custom member selection ({members.length} member{members.length !== 1 ? 's' : ''})
                </>
              )}
              {memberSetup === 'inherit' && (
                <>
                  Members are inherited from the workspace
                </>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Add Member Dropdown - Only show for workspace or custom board members, not just_me */}
        {!isJustMe && !pendingMember && (
          <div className="px-6 pt-4 pb-2 relative z-10">
            <MemberDropdown
              members={allUsers}
              excludeIds={members.map(m => m.id)}
              onSelect={handleMemberSelected}
              placeholder="Add member..."
              buttonLabel={isBoardSpecific ? 'Add Board Member' : 'Add Member'}
              showSelectedInButton={false}
              loading={isLoading}
              disabled={isUpdating}
              emptyMessage="No more users to add"
              maxHeight="300px"
            />
          </div>
        )}

        {/* Role Selection UI - Shows when a member is selected (for board-specific members only) */}
        {pendingMember && (
          <div className="px-6 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {getInitials(pendingMember.displayName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {pendingMember.displayName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {pendingMember.email}
                </p>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select role for this member:
              </label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {(() => {
                  const selectedRole = roles.find(r => r.id === selectedRoleId);
                  if (!selectedRole) return 'Select a role for this member.';
                  if (selectedRole.title.toLowerCase() === 'admin') {
                    return 'Admins can edit board settings and manage members.';
                  } else if (selectedRole.title.toLowerCase() === 'editor') {
                    return 'Editors can view and edit cards on this board.';
                  } else if (selectedRole.title.toLowerCase() === 'viewer') {
                    return 'Viewers can only view cards on this board.';
                  }
                  return `${selectedRole.title} role.`;
                })()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelRoleSelection}
                className="flex-1 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddMember}
                disabled={isUpdating || !selectedRoleId}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Add as {roles.find(r => r.id === selectedRoleId)?.title || 'Member'}</>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Members List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No members yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium mr-3">
                    {getInitials(member.displayName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {member.displayName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Role dropdown - show for workspace members and board-specific custom members */}
                    {!isJustMe && roles.length > 0 && (
                      <select
                        value={getMemberRole(member.id)?.id || ''}
                        onChange={(e) => handleChangeRole(member.id, e.target.value)}
                        disabled={isUpdating}
                        className="text-xs px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.title}
                          </option>
                        ))}
                      </select>
                    )}
                    {/* Remove button - show for workspace and custom board members, not just_me */}
                    {!isJustMe && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={isUpdating}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                        title={isBoardSpecific ? 'Remove from board' : 'Remove from workspace'}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Link
            to={`/workspace/${workspaceId}/settings`}
            className="flex items-center justify-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Manage workspace settings
          </Link>
        </div>
      </div>
    </div>
  );
}
