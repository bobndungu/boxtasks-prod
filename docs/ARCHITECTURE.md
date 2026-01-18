# BoxTasks Technical Architecture

This document describes the technical architecture of BoxTasks, including system design, data flow, and implementation details.

## Table of Contents

1. [System Overview](#system-overview)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Data Flow](#data-flow)
5. [Real-time System](#real-time-system)
6. [Authentication Flow](#authentication-flow)
7. [State Management](#state-management)
8. [API Design](#api-design)
9. [Caching Strategy](#caching-strategy)
10. [Performance Optimizations](#performance-optimizations)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     React SPA (PWA)                               │   │
│  │  - Vite + TypeScript                                             │   │
│  │  - TanStack Query for data fetching                              │   │
│  │  - Zustand for client state                                      │   │
│  │  - Service Worker for offline support                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API Layer                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Drupal 11 Backend                             │   │
│  │  - JSON:API for RESTful endpoints                                │   │
│  │  - Simple OAuth 2.0 for authentication                           │   │
│  │  - Custom modules for business logic                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│      MySQL        │   │      Redis        │   │     Mercure       │
│  (Primary DB)     │   │     (Cache)       │   │   (Real-time)     │
└───────────────────┘   └───────────────────┘   └───────────────────┘
```

### Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + TypeScript | UI rendering |
| Build | Vite | Development and bundling |
| Styling | Tailwind CSS | Utility-first CSS |
| State | Zustand | Client-side state |
| Data | TanStack Query | Server state & caching |
| Backend | Drupal 11 | Content management & API |
| API | JSON:API | RESTful data exchange |
| Auth | Simple OAuth 2.0 | Token-based authentication |
| Real-time | Mercure | Server-sent events |
| Database | MySQL 8.0 | Data persistence |
| Cache | Redis | Session & data caching |

---

## Backend Architecture

### Drupal Module Structure

```
web/modules/custom/
├── boxtasks_core/           # Core entities and services
│   ├── src/
│   │   ├── Entity/          # Custom entity definitions
│   │   ├── Controller/      # API controllers
│   │   └── Service/         # Business logic services
│   └── config/install/      # Default configuration
├── boxtasks_auth/           # Authentication module
│   ├── src/
│   │   └── Controller/      # OAuth endpoints
│   └── config/              # OAuth configuration
├── boxtasks_realtime/       # Mercure integration
│   └── src/
│       └── EventSubscriber/ # Event publishers
├── boxtasks_automation/     # Automation rules
└── boxtasks_audit/          # Audit logging
```

### Entity Relationships

```
Workspace (1) ─────────────────── (n) Board
    │                                  │
    │                                  │
    └──── (n) WorkspaceMember         (n) List
                                       │
                                       │
                                      (n) Card
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
               (n) Comment            (n) Label              (n) Checklist
                                                              │
                                                             (n) ChecklistItem
```

### JSON:API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/jsonapi/node/workspace` | GET, POST, PATCH, DELETE | Workspace CRUD |
| `/jsonapi/node/board` | GET, POST, PATCH, DELETE | Board CRUD |
| `/jsonapi/node/list` | GET, POST, PATCH, DELETE | List CRUD |
| `/jsonapi/node/card` | GET, POST, PATCH, DELETE | Card CRUD |
| `/jsonapi/comment/comment` | GET, POST, PATCH, DELETE | Comments |
| `/jsonapi/user/user` | GET, PATCH | User management |

### Custom API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/board/{id}/reorder-lists` | POST | Reorder lists in board |
| `/api/list/{id}/reorder-cards` | POST | Reorder cards in list |
| `/api/board/{id}/activity` | GET | Board activity feed |
| `/api/workspace/{id}/members` | GET, POST, DELETE | Member management |

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── components/              # Reusable components
│   ├── ui/                  # Base UI components (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── board/               # Board-specific components
│   │   ├── SortableList.tsx
│   │   ├── CardDetailModal.tsx
│   │   └── ...
│   ├── MainHeader.tsx       # App header
│   ├── MobileNav.tsx        # Mobile navigation
│   └── ...
├── pages/                   # Route page components
│   ├── Dashboard.tsx
│   ├── BoardView.tsx
│   ├── WorkspaceView.tsx
│   └── ...
├── lib/
│   ├── api/                 # API client functions
│   │   ├── client.ts        # HTTP client setup
│   │   ├── boards.ts
│   │   ├── cards.ts
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   │   ├── useMercure.ts    # Real-time subscription
│   │   ├── usePermissions.ts
│   │   └── ...
│   ├── stores/              # Zustand stores
│   │   ├── auth.ts
│   │   ├── board.ts
│   │   └── ...
│   └── utils/               # Utility functions
│       ├── date.ts
│       └── ...
├── types/                   # TypeScript definitions
│   └── index.ts
└── App.tsx                  # Root component with routing
```

### Component Hierarchy

```
App
├── AuthProvider
│   └── QueryClientProvider
│       └── Router
│           ├── MainHeader / MobileNav
│           └── Routes
│               ├── Dashboard
│               ├── BoardView
│               │   ├── BoardHeader (Row 1 & 2)
│               │   ├── ViewSelector
│               │   └── KanbanView / CalendarView / etc.
│               │       └── SortableList
│               │           └── CardItem
│               │               └── CardDetailModal
│               ├── WorkspaceView
│               └── ...
```

### Key Components

| Component | Purpose | File |
|-----------|---------|------|
| `BoardView` | Main board page with all views | `pages/BoardView.tsx` |
| `CardDetailModal` | Full card editing interface | `components/board/CardDetailModal.tsx` |
| `SortableList` | Draggable list with cards | `components/board/SortableList.tsx` |
| `MainHeader` | App-wide navigation header | `components/MainHeader.tsx` |
| `MobileNav` | Mobile-specific navigation | `components/MobileNav.tsx` |
| `ViewSelector` | Switch between board views | `components/ViewSelector.tsx` |
| `AdvancedFilters` | Card filtering interface | `components/AdvancedFilters.tsx` |

---

## Data Flow

### Read Flow (Query)

```
User Action
    │
    ▼
React Component
    │
    ├── useQuery() hook ──────────────────┐
    │                                      │
    ▼                                      ▼
Check TanStack Query Cache          Fetch from API
    │                                      │
    ├── Cache Hit ─────────────────────────┤
    │                                      │
    ▼                                      ▼
Return Cached Data              JSON:API Response
                                           │
                                           ▼
                                    Update Cache
                                           │
                                           ▼
                                    Re-render Component
```

### Write Flow (Mutation)

```
User Action (e.g., Update Card)
    │
    ▼
React Component
    │
    ├── Optimistic Update (immediate UI feedback)
    │
    ├── useMutation() hook
    │       │
    │       ▼
    │   API Request (PATCH /jsonapi/node/card/{id})
    │       │
    │       ▼
    │   Drupal Backend
    │       │
    │       ├── Validate Request
    │       ├── Update Database
    │       ├── Publish Mercure Event
    │       └── Return Response
    │
    ├── On Success
    │       ├── Confirm Optimistic Update
    │       └── Invalidate Related Queries
    │
    └── On Error
            ├── Rollback Optimistic Update
            └── Show Error Toast
```

### Real-time Update Flow

```
Backend Change (any client)
    │
    ▼
Drupal Event Subscriber
    │
    ├── Create Mercure Update
    │       Topic: /boards/{boardId}
    │       Data: { type: 'card:updated', payload: {...} }
    │
    └── Publish to Mercure Hub
            │
            ▼
Mercure Hub (SSE)
    │
    ├── Push to all subscribed clients
    │
    ▼
Frontend (all connected clients)
    │
    ├── useMercure hook receives event
    │
    ├── Process event based on type
    │       ├── card:created → Add to state
    │       ├── card:updated → Update in state
    │       └── card:deleted → Remove from state
    │
    └── Re-render affected components
```

---

## Real-time System

### Mercure Configuration

```typescript
// Connection setup
const mercureUrl = new URL(MERCURE_HUB_URL);
mercureUrl.searchParams.append('topic', `/boards/${boardId}`);

const eventSource = new EventSource(mercureUrl, {
  withCredentials: true,
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleEvent(data);
};
```

### Event Types and Handlers

```typescript
interface MercureEvent {
  type: EventType;
  payload: any;
  timestamp: string;
  userId: string;
}

type EventType =
  | 'card:created'
  | 'card:updated'
  | 'card:deleted'
  | 'card:moved'
  | 'list:created'
  | 'list:updated'
  | 'list:deleted'
  | 'comment:created'
  | 'comment:deleted'
  | 'presence:joined'
  | 'presence:left';

// Handler example
const handlers: Record<EventType, (payload: any) => void> = {
  'card:created': (card) => {
    setCardsByList(prev => {
      const listCards = prev.get(card.listId) || [];
      return new Map(prev).set(card.listId, [card, ...listCards]);
    });
  },
  // ... other handlers
};
```

### Connection State Management

```typescript
interface MercureConnection {
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
  lastConnected: Date | null;
  reconnect: () => void;
}

// Auto-reconnect with exponential backoff
const reconnect = () => {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  setTimeout(() => connect(), delay);
};
```

---

## Authentication Flow

### OAuth 2.0 Flow

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │      │   Drupal    │      │   OAuth     │
│  (Frontend) │      │  (Backend)  │      │  Provider   │
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    │
       │ 1. Click Login     │                    │
       │───────────────────►│                    │
       │                    │                    │
       │ 2. Redirect to OAuth Provider          │
       │◄───────────────────│                    │
       │                    │                    │
       │ 3. Redirect to Provider Login          │
       │────────────────────────────────────────►│
       │                    │                    │
       │ 4. User Authenticates                  │
       │◄────────────────────────────────────────│
       │                    │                    │
       │ 5. Callback with Auth Code             │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ 6. Exchange Code   │
       │                    │───────────────────►│
       │                    │                    │
       │                    │ 7. Return Tokens   │
       │                    │◄───────────────────│
       │                    │                    │
       │ 8. Return JWT Token│                    │
       │◄───────────────────│                    │
       │                    │                    │
       │ 9. Store Token     │                    │
       │ (localStorage)     │                    │
```

### Token Management

```typescript
// Token storage
const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
};

// Token refresh (before expiration)
const refreshTokens = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  const response = await fetch('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const { access_token, refresh_token } = await response.json();
  setTokens(access_token, refresh_token);
};

// API request interceptor
const apiClient = {
  fetch: async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('access_token');
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
      },
    });
  },
};
```

---

## State Management

### Client State (Zustand)

Used for UI state that doesn't need server sync:

```typescript
// frontend/src/lib/stores/auth.ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, isAuthenticated: false });
  },
}));
```

### Server State (TanStack Query)

Used for data that comes from the API:

```typescript
// Fetch boards with caching
export function useBoards(workspaceId: string) {
  return useQuery({
    queryKey: ['boards', workspaceId],
    queryFn: () => fetchBoards(workspaceId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation with optimistic update
export function useUpdateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCard,
    onMutate: async (updatedCard) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['cards', updatedCard.listId]);

      // Snapshot previous value
      const previousCards = queryClient.getQueryData(['cards', updatedCard.listId]);

      // Optimistically update
      queryClient.setQueryData(['cards', updatedCard.listId], (old) =>
        old.map((c) => c.id === updatedCard.id ? updatedCard : c)
      );

      return { previousCards };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(
        ['cards', variables.listId],
        context.previousCards
      );
    },
    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries(['cards']);
    },
  });
}
```

### Local Component State

Used for component-specific state:

```typescript
// BoardView.tsx
const [selectedCard, setSelectedCard] = useState<Card | null>(null);
const [showSearch, setShowSearch] = useState(false);
const [currentView, setCurrentView] = useState<ViewType>('kanban');
```

---

## API Design

### JSON:API Compliance

All data endpoints follow JSON:API specification:

```json
// GET /jsonapi/node/card/{id}
{
  "data": {
    "type": "node--card",
    "id": "uuid-here",
    "attributes": {
      "title": "Card Title",
      "field_description": "Description",
      "field_due_date": "2025-01-20T17:00:00+00:00"
    },
    "relationships": {
      "field_list": {
        "data": { "type": "node--list", "id": "list-uuid" }
      },
      "field_members": {
        "data": [
          { "type": "user--user", "id": "user-uuid" }
        ]
      }
    }
  }
}
```

### API Client Pattern

```typescript
// frontend/src/lib/api/client.ts
const API_BASE = import.meta.env.VITE_API_URL;

export async function jsonApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('access_token');

  const response = await fetch(`${API_BASE}/jsonapi/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.json());
  }

  return response.json();
}
```

---

## Caching Strategy

### Multi-Layer Caching

```
┌─────────────────────────────────────────────────────┐
│                   Browser Cache                      │
│  ┌─────────────────────────────────────────────┐   │
│  │              Service Worker                   │   │
│  │  - Static assets (StaleWhileRevalidate)      │   │
│  │  - API responses (NetworkFirst)              │   │
│  └─────────────────────────────────────────────┘   │
│                        │                            │
│  ┌─────────────────────▼───────────────────────┐   │
│  │           TanStack Query Cache               │   │
│  │  - In-memory server state cache              │   │
│  │  - Automatic background refetching           │   │
│  │  - Optimistic updates                        │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                   Server Cache                       │
│  ┌─────────────────────────────────────────────┐   │
│  │                   Redis                       │   │
│  │  - Session storage                           │   │
│  │  - Database query cache                      │   │
│  │  - Rate limiting counters                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Service Worker Caching

```typescript
// vite.config.ts - Workbox configuration
workbox: {
  runtimeCaching: [
    {
      // API: Network first, fall back to cache
      urlPattern: /\/jsonapi\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24, // 24 hours
        },
      },
    },
    {
      // Static assets: Cache first, update in background
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
  ],
}
```

---

## Performance Optimizations

### Code Splitting

```typescript
// vite.config.ts - Manual chunks
rollupOptions: {
  output: {
    manualChunks: {
      'vendor-react': ['react', 'react-dom', 'react-router-dom'],
      'vendor-state': ['zustand', '@tanstack/react-query'],
      'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
      'vendor-ui': ['lucide-react'],
    },
  },
}
```

### Lazy Loading

```typescript
// Route-based code splitting
const BoardView = lazy(() => import('./pages/BoardView'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const MindMapView = lazy(() => import('./components/MindMapView'));

// Usage with Suspense
<Suspense fallback={<BoardSkeleton />}>
  <BoardView />
</Suspense>
```

### Memoization

```typescript
// Expensive computations
const filteredCards = useMemo(() => {
  return cards.filter(card => matchesFilters(card, filters));
}, [cards, filters]);

// Callback memoization
const handleCardClick = useCallback((card: Card) => {
  setSelectedCard(card);
}, []);
```

### Virtual Lists

For long lists, consider virtualization:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: cards.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 100,
});
```

### Image Optimization

- Use WebP format where possible
- Implement lazy loading for images
- Use appropriate image sizes for different viewports

---

## Security Considerations

### Frontend Security

- XSS prevention via React's built-in escaping
- CSRF tokens for mutations
- Secure token storage (consider HttpOnly cookies for production)
- Content Security Policy headers

### Backend Security

- Input validation on all endpoints
- Rate limiting on authentication endpoints
- Audit logging for sensitive operations
- CORS configuration for allowed origins

### API Security

- JWT token validation on every request
- Role-based access control checks
- SQL injection prevention via Drupal's database abstraction
- File upload validation and sanitization
