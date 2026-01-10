import type { PresenceUser } from '../lib/api/presence';

interface ActiveUsersProps {
  users: PresenceUser[];
  maxDisplay?: number;
}

export function ActiveUsers({ users, maxDisplay = 5 }: ActiveUsersProps) {
  if (users.length === 0) {
    return null;
  }

  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;

  return (
    <div className="flex items-center gap-1" title={`${users.length} user${users.length > 1 ? 's' : ''} viewing this board`}>
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <div
            key={user.userId}
            className="relative w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium ring-2 ring-white"
            title={user.displayName}
          >
            {user.avatar}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white" />
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-medium ring-2 ring-white">
            +{remainingCount}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-500 ml-1">
        {users.length === 1 ? '1 viewer' : `${users.length} viewers`}
      </span>
    </div>
  );
}
