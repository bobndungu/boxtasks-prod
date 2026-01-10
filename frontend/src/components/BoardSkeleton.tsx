import { Skeleton } from './ui/skeleton';

// Card skeleton component
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-3 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
    </div>
  );
}

// List skeleton component
export function ListSkeleton({ cardCount = 3 }: { cardCount?: number }) {
  return (
    <div className="bg-gray-100 rounded-xl w-72 flex-shrink-0 p-3 space-y-3">
      {/* List header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-5" />
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Add card button */}
      <Skeleton className="h-8 w-full rounded" />
    </div>
  );
}

// Full board skeleton
export function BoardSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Board header skeleton */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Board toolbar skeleton */}
      <div className="bg-white border-b px-6 py-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-8 w-28 rounded" />
        </div>
      </div>

      {/* Board content skeleton */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full">
          <ListSkeleton cardCount={4} />
          <ListSkeleton cardCount={3} />
          <ListSkeleton cardCount={5} />
          <ListSkeleton cardCount={2} />

          {/* Add list button skeleton */}
          <div className="w-72 flex-shrink-0">
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Workspace list skeleton
export function WorkspaceListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Board grid skeleton
export function BoardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border overflow-hidden">
          <Skeleton className="h-24 w-full" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Card modal skeleton
export function CardModalSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Labels */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded" />
        <Skeleton className="h-6 w-20 rounded" />
        <Skeleton className="h-6 w-14 rounded" />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-20 w-full rounded" />
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full rounded" />
          <Skeleton className="h-8 w-full rounded" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
      </div>

      {/* Activity */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-20" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Notification list skeleton
export function NotificationSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-lg">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Generic loading spinner
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-blue-600`}
      />
    </div>
  );
}

// Full page loading state
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <LoadingSpinner size="lg" />
      <p className="text-gray-500">{message}</p>
    </div>
  );
}
