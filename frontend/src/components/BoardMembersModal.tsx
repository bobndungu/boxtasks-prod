import { useState, useEffect } from 'react';
import { X, Loader2, Search, UserPlus, Shield, Users, ExternalLink } from 'lucide-react';
import { fetchWorkspaceMembers, searchUsers, updateWorkspaceMembers, type WorkspaceMember } from '../lib/api/workspaces';
import { toast } from '../lib/stores/toast';
import { Link } from 'react-router-dom';

interface BoardMembersModalProps {
  boardId: string;
  workspaceId: string;
  onClose: () => void;
}

export default function BoardMembersModal({
  boardId: _boardId,
  workspaceId,
  onClose,
}: BoardMembersModalProps) {
  void _boardId; // Used for future board-specific member filtering
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WorkspaceMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [workspaceId]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWorkspaceMembers(workspaceId);
      setMembers(data);
    } catch (err) {
      toast.error('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchUsers(searchQuery);
        // Filter out existing members
        const existingIds = new Set(members.map(m => m.id));
        setSearchResults(results.filter(r => !existingIds.has(r.id)));
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, members]);

  const handleAddMember = async (user: WorkspaceMember) => {
    setIsUpdating(true);
    try {
      const memberIds = [...members.map(m => m.id), user.id];
      const adminIds = members.filter(m => m.isAdmin).map(m => m.id);
      await updateWorkspaceMembers(workspaceId, memberIds, adminIds);
      setMembers([...members, { ...user, isAdmin: false }]);
      setSearchQuery('');
      setSearchResults([]);
      toast.success(`${user.displayName} added to workspace`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const member = members.find(m => m.id === userId);
    if (!member) return;

    // Don't allow removing the last admin
    if (member.isAdmin && members.filter(m => m.isAdmin).length <= 1) {
      toast.error('Cannot remove the last admin');
      return;
    }

    setIsUpdating(true);
    try {
      const memberIds = members.filter(m => m.id !== userId).map(m => m.id);
      const adminIds = members.filter(m => m.isAdmin && m.id !== userId).map(m => m.id);
      await updateWorkspaceMembers(workspaceId, memberIds, adminIds);
      setMembers(members.filter(m => m.id !== userId));
      toast.success(`${member.displayName} removed from workspace`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleAdmin = async (userId: string) => {
    const member = members.find(m => m.id === userId);
    if (!member) return;

    // Don't allow removing the last admin
    if (member.isAdmin && members.filter(m => m.isAdmin).length <= 1) {
      toast.error('Cannot remove the last admin');
      return;
    }

    setIsUpdating(true);
    try {
      const memberIds = members.map(m => m.id);
      let adminIds = members.filter(m => m.isAdmin).map(m => m.id);

      if (member.isAdmin) {
        adminIds = adminIds.filter(id => id !== userId);
      } else {
        adminIds = [...adminIds, userId];
      }

      await updateWorkspaceMembers(workspaceId, memberIds, adminIds);
      setMembers(members.map(m =>
        m.id === userId ? { ...m, isAdmin: !m.isAdmin } : m
      ));
      toast.success(`${member.displayName} is ${member.isAdmin ? 'no longer' : 'now'} an admin`);
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Board Members</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Members are inherited from the workspace
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Member Section */}
          {showAddMember ? (
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>

              {isSearching && (
                <div className="mt-2 flex items-center text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Searching...
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAddMember(user)}
                      disabled={isUpdating}
                      className="w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium mr-3">
                        {getInitials(user.displayName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {user.displayName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </p>
                      </div>
                      <UserPlus className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No users found matching "{searchQuery}"
                </p>
              )}

              <button
                onClick={() => {
                  setShowAddMember(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddMember(true)}
              className="mb-6 w-full flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </button>
          )}

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
                      {member.isAdmin && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleAdmin(member.id)}
                      disabled={isUpdating}
                      className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 ${
                        member.isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                      }`}
                      title={member.isAdmin ? 'Remove admin' : 'Make admin'}
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={isUpdating}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                      title="Remove from workspace"
                    >
                      <X className="h-4 w-4" />
                    </button>
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
