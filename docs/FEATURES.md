# BoxTasks Features Documentation

This document provides comprehensive documentation of all BoxTasks features, including how they work and how they are implemented.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Workspaces](#workspaces)
3. [Boards](#boards)
4. [Lists](#lists)
5. [Cards](#cards)
6. [Views](#views)
7. [Real-time Collaboration](#real-time-collaboration)
8. [Progressive Web App (PWA)](#progressive-web-app-pwa)
9. [Responsive Design](#responsive-design)
10. [Notifications](#notifications)
11. [Search & Filters](#search--filters)
12. [Automation](#automation)

---

## Authentication & Authorization

### Overview

BoxTasks uses OAuth 2.0 for authentication with support for multiple providers.

### Authentication Methods

| Method | Description | Implementation |
|--------|-------------|----------------|
| Email/Password | Traditional login | Drupal user system + Simple OAuth |
| Google OAuth | Sign in with Google | OAuth 2.0 with Google provider |
| Microsoft OAuth | Sign in with Microsoft | OAuth 2.0 with Azure AD |

### How It Works

1. **Token-based Auth**: Frontend obtains JWT tokens via OAuth flow
2. **Token Storage**: Tokens stored in localStorage with refresh mechanism
3. **API Requests**: All API calls include `Authorization: Bearer <token>` header
4. **Session Management**: Tokens auto-refresh before expiration

### Implementation Files

- `frontend/src/lib/api/auth.ts` - Authentication API calls
- `frontend/src/lib/stores/auth.ts` - Auth state management (Zustand)
- `frontend/src/components/OAuthCallback.tsx` - OAuth redirect handler
- `web/modules/custom/boxtasks_auth/` - Drupal auth module

### Role-Based Permissions

| Role | Capabilities |
|------|-------------|
| Owner | Full control, can delete workspace |
| Admin | Manage members, boards, settings |
| Member | Create/edit boards and cards |
| Viewer | Read-only access |

Permissions are checked via the `usePermissions` hook:

```typescript
const { canEdit, canDelete, canCreate } = usePermissions(workspaceId);

if (canEdit('card')) {
  // Show edit button
}
```

---

## Workspaces

### Overview

Workspaces are the top-level organizational unit containing boards and members.

### Features

- Create and manage workspaces
- Invite members with specific roles
- Workspace-level settings and permissions
- Activity feed for all workspace actions

### Data Model

```typescript
interface Workspace {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}
```

### Implementation Files

- `frontend/src/pages/WorkspaceView.tsx` - Workspace page
- `frontend/src/pages/WorkspaceSettings.tsx` - Workspace settings
- `frontend/src/lib/api/workspaces.ts` - API functions
- `frontend/src/components/WorkspaceSwitcher.tsx` - Workspace dropdown

---

## Boards

### Overview

Boards are Kanban-style containers for organizing tasks into lists and cards.

### Features

- Customizable background colors
- Star/favorite boards for quick access
- Board-specific member assignments
- Multiple view modes (Kanban, Calendar, Timeline, etc.)
- Board chat for team communication
- Activity sidebar with full history

### Board Header Layout

The board header uses a responsive two-row layout:

**Row 1: Primary Navigation**
- BoxTasks logo and link to dashboard
- Back arrow to workspace
- Board title (editable)
- Star button
- Board members button
- Board settings button
- Board chat button
- Connection status indicator

**Row 2: Board Actions**
- Left group: Search, Filters, My Cards
- Right group: Share, Activity, Archived, View selector, Options

### Mobile Responsiveness

At mobile breakpoints (< 640px):
- Board name moves to its own line for better readability
- Icons are condensed
- At very small screens (< 320px), chat button moves to the board name row

Implementation in `frontend/src/pages/BoardView.tsx`:

```tsx
{/* Mobile: Board name on its own line */}
<div className="sm:hidden flex items-center gap-2 px-1">
  <button className="text-lg font-bold text-white...">
    {currentBoard?.title}
  </button>
</div>

{/* Desktop: Board title inline */}
<div className="hidden sm:block min-w-0 flex-1">
  <button className="text-xl font-bold text-white...">
    {currentBoard?.title}
  </button>
</div>
```

### Data Model

```typescript
interface Board {
  id: string;
  title: string;
  background: string;
  workspaceId: string;
  starred: boolean;
  members: BoardMember[];
  createdAt: string;
  updatedAt: string;
}
```

### Implementation Files

- `frontend/src/pages/BoardView.tsx` - Main board view (2800+ lines)
- `frontend/src/components/board/` - Board sub-components
- `frontend/src/lib/api/boards.ts` - Board API functions
- `frontend/src/components/BoardSettingsModal.tsx` - Board settings
- `frontend/src/components/BoardMembersModal.tsx` - Member management

---

## Lists

### Overview

Lists are vertical columns within a board that contain cards.

### Features

- Drag and drop reordering
- Collapse/expand lists
- Archive lists
- Copy/move cards between lists

### Implementation

Lists use dnd-kit for drag and drop:

```typescript
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';

<SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
  {lists.map(list => (
    <SortableList key={list.id} list={list} cards={cardsByList.get(list.id)} />
  ))}
</SortableContext>
```

### Data Model

```typescript
interface BoardList {
  id: string;
  title: string;
  boardId: string;
  position: number;
  archived: boolean;
}
```

### Implementation Files

- `frontend/src/components/board/SortableList.tsx` - Draggable list
- `frontend/src/lib/api/lists.ts` - List API functions

---

## Cards

### Overview

Cards are the core task items containing all task information.

### Features

- Rich description with markdown support
- Due dates with start and end times
- Labels with customizable colors
- Member assignments
- Checklists with progress tracking
- Comments with @mentions
- Attachments and Google Docs integration
- Custom fields
- Card dependencies
- Activity history

### Card Fields

| Field | Type | Description |
|-------|------|-------------|
| title | string | Card title |
| description | string | Markdown description |
| dueDate | datetime | Due date and time |
| startDate | datetime | Start date |
| labels | Label[] | Color-coded labels |
| members | Member[] | Assigned members |
| checklists | Checklist[] | Task checklists |
| customFields | CustomField[] | Custom data fields |
| archived | boolean | Archive status |

### Card Quick Actions

On hover, cards show quick action buttons:
- Mark complete
- Edit card
- Archive card

### Implementation Files

- `frontend/src/components/board/CardDetailModal.tsx` - Full card editor
- `frontend/src/components/board/CardDragOverlay.tsx` - Drag preview
- `frontend/src/lib/api/cards.ts` - Card API functions
- `frontend/src/lib/api/comments.ts` - Comment functions
- `frontend/src/lib/api/checklists.ts` - Checklist functions

---

## Views

### Overview

BoxTasks supports multiple views for visualizing tasks.

### Available Views

| View | Description | Use Case |
|------|-------------|----------|
| Kanban | Traditional board layout | Day-to-day task management |
| Calendar | Month/week calendar view | Deadline tracking |
| Timeline | Gantt-style timeline | Project planning |
| Table | Spreadsheet-like table | Bulk editing, exports |
| Dashboard | Charts and statistics | Progress tracking |

### View Implementation

```typescript
type ViewType = 'kanban' | 'calendar' | 'timeline' | 'table' | 'dashboard';

// View switcher in board toolbar
<ViewSelector currentView={currentView} onViewChange={setCurrentView} />

// Render appropriate view
{currentView === 'kanban' && <KanbanView lists={lists} cards={cards} />}
{currentView === 'calendar' && <CalendarView cards={allCards} />}
{currentView === 'timeline' && <TimelineView cards={allCards} />}
{currentView === 'table' && <TableView cards={allCards} />}
{currentView === 'dashboard' && <DashboardView cards={allCards} />}
```

### Saved Views

Users can save view configurations (filters + view type) for quick access:

```typescript
interface SavedView {
  id: string;
  name: string;
  viewType: ViewType;
  filters: FilterState;
  settings: ViewSettingsData;
  isDefault: boolean;
}
```

### Implementation Files

- `frontend/src/components/ViewSelector.tsx` - View type dropdown
- `frontend/src/components/ViewSettings.tsx` - View configuration
- `frontend/src/components/SavedViews.tsx` - Saved view management
- `frontend/src/components/CalendarView.tsx` - Calendar view
- `frontend/src/components/TimelineView.tsx` - Timeline/Gantt view
- `frontend/src/components/TableView.tsx` - Table view
- `frontend/src/components/DashboardView.tsx` - Dashboard charts

---

## Real-time Collaboration

### Overview

BoxTasks uses Mercure for Server-Sent Events (SSE) to provide real-time updates.

### How It Works

1. **Connection**: Frontend subscribes to Mercure hub topics
2. **Events**: Backend publishes events when data changes
3. **Updates**: Frontend receives events and updates UI optimistically

### Event Types

| Event | Description |
|-------|-------------|
| `card:created` | New card added |
| `card:updated` | Card modified |
| `card:deleted` | Card removed |
| `card:moved` | Card moved between lists |
| `list:created` | New list added |
| `list:updated` | List modified |
| `comment:created` | New comment added |
| `member:joined` | User joined board |
| `member:left` | User left board |

### Implementation

```typescript
// Subscribe to board updates
const { mercureConnection, activeUsers } = useBoardUpdates(boardId, {
  onCardCreated: (card) => handleCardCreated(card),
  onCardUpdated: (card) => handleCardUpdated(card),
  onCardDeleted: (cardId) => handleCardDeleted(cardId),
});

// Connection status indicator
<ConnectionStatus
  state={mercureConnection}
  onReconnect={mercureConnection.reconnect}
/>
```

### Active Users

Shows who else is viewing the board in real-time:

```typescript
<ActiveUsers users={activeUsers} maxDisplay={3} />
```

### Implementation Files

- `frontend/src/lib/hooks/useMercure.ts` - Mercure subscription hook
- `frontend/src/lib/hooks/usePresence.ts` - User presence tracking
- `frontend/src/components/ConnectionStatus.tsx` - Connection indicator
- `frontend/src/components/ActiveUsers.tsx` - Active users display

---

## Progressive Web App (PWA)

### Overview

BoxTasks is a fully-featured PWA that can be installed on any device.

### Features

- **Installable**: Add to home screen on mobile/desktop
- **Offline Support**: Continue viewing cached data offline
- **Auto-updates**: Background service worker updates
- **Fast Loading**: Aggressive caching for instant loads

### Service Worker Configuration

Located in `frontend/vite.config.ts`:

```typescript
VitePWA({
  registerType: 'prompt',
  workbox: {
    // Immediate activation of new service worker
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,

    // Caching strategies
    runtimeCaching: [
      {
        // API calls - network first with cache fallback
        urlPattern: /\/jsonapi\/.*/i,
        handler: 'NetworkFirst',
        options: {
          networkTimeoutSeconds: 10,
          cacheName: 'api-cache',
        },
      },
      {
        // Static assets - stale while revalidate
        urlPattern: /\.(?:js|css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-assets',
        },
      },
    ],
  },
})
```

### Auto-Update System

The PWA automatically checks for updates and applies them:

```typescript
// frontend/src/components/PWAPrompt.tsx
const UPDATE_CHECK_INTERVAL = 30 * 1000; // 30 seconds
const AUTO_UPDATE_MODE: 'prompt' | 'auto' = 'auto';

useRegisterSW({
  onRegistered(registration) {
    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, UPDATE_CHECK_INTERVAL);
  },
});

// Auto-update when new version is available
useEffect(() => {
  if (needRefresh && AUTO_UPDATE_MODE === 'auto') {
    updateServiceWorker(true);
  }
}, [needRefresh]);
```

### Nginx Configuration for SW

Prevent caching of service worker files:

```nginx
# Never cache service worker
location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

location ~* workbox.*\.js$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### Implementation Files

- `frontend/vite.config.ts` - PWA plugin configuration
- `frontend/src/components/PWAPrompt.tsx` - Update prompt & auto-update
- `frontend/src/lib/hooks/useServiceWorker.ts` - SW management hook

---

## Responsive Design

### Overview

BoxTasks uses a mobile-first responsive design with Tailwind CSS breakpoints.

### Breakpoints

| Breakpoint | Size | Usage |
|------------|------|-------|
| Default | < 640px | Mobile phones |
| `sm:` | 640px+ | Large phones |
| `md:` | 768px+ | Tablets |
| `lg:` | 1024px+ | Small laptops |
| `xl:` | 1280px+ | Desktops |
| `2xl:` | 1536px+ | Large screens |

### Responsive Patterns

**Board Header (Row 1)**:
- Mobile: Icons in row, board name on separate line
- Desktop: All elements inline

```tsx
// Mobile: flex-col, Desktop: flex-row
<div className="flex flex-col sm:flex-row sm:items-center gap-2">
  {/* Icons row */}
  <div className="flex items-center...">
    {/* Logo, back, star, members, settings, chat */}
  </div>

  {/* Board name - mobile only */}
  <div className="sm:hidden">
    <button>{boardTitle}</button>
  </div>
</div>
```

**Board Toolbar (Row 2)**:
- Uses `justify-between` to spread items
- Left group: Search, Filters, My Cards
- Right group: Share, Activity, Archived, Views, Options

```tsx
<div className="flex items-center justify-between gap-2 flex-wrap">
  {/* Left side */}
  <div className="flex items-center gap-2">
    <SearchButton />
    <FiltersButton />
    <MyCardsButton />
  </div>

  {/* Right side */}
  <div className="flex items-center gap-2">
    <ShareButton />
    <ActivityButton />
    <ViewSelector />
    <OptionsButton />
  </div>
</div>
```

**Dashboard Header**:
- Hides "Everything" and "My Cards" links until `xl:` (1280px)
- Responsive spacing with `space-x-2 lg:space-x-4 xl:space-x-6`

### Implementation Files

- `frontend/src/pages/BoardView.tsx` - Board responsive layout
- `frontend/src/pages/Dashboard.tsx` - Dashboard responsive layout
- `frontend/src/components/MainHeader.tsx` - Main navigation responsive
- `frontend/src/components/MobileNav.tsx` - Mobile-specific navigation

---

## Notifications

### Overview

BoxTasks provides in-app and push notifications for important events.

### Notification Types

| Type | Trigger |
|------|---------|
| @mention | User mentioned in comment |
| Assignment | Card assigned to user |
| Due date | Card due date approaching |
| Comment | New comment on watched card |

### Implementation

```typescript
// Notification dropdown in header
<NotificationDropdown />

// Notification settings page
<NotificationSettings />
```

### Implementation Files

- `frontend/src/components/NotificationDropdown.tsx` - Notification bell
- `frontend/src/pages/NotificationSettings.tsx` - Notification preferences
- `frontend/src/lib/api/notifications.ts` - Notification API

---

## Search & Filters

### Overview

Powerful search and filtering capabilities across boards.

### Search Features

- Global search across all boards (Cmd/Ctrl + K)
- Board-specific card search
- Real-time search results

### Advanced Filters

| Filter | Description |
|--------|-------------|
| Labels | Filter by card labels |
| Members | Filter by assigned members |
| Due Date | Filter by due date range |
| Custom Fields | Filter by custom field values |
| No Members | Show unassigned cards |
| Overdue | Show overdue cards |

### Filter Implementation

```typescript
interface FilterState {
  labels: string[];
  members: string[];
  dueDateRange: { start?: Date; end?: Date };
  customFields: Record<string, any>;
  showNoMembers: boolean;
  showOverdue: boolean;
}

// Apply filters to cards
const filteredCards = cards.filter(card => matchesFilters(card, filters));
```

### Implementation Files

- `frontend/src/components/SearchModal.tsx` - Global search
- `frontend/src/components/AdvancedFilters.tsx` - Filter panel
- `frontend/src/pages/EverythingView.tsx` - All cards view
- `frontend/src/pages/MyCards.tsx` - User's assigned cards

---

## Automation

### Overview

Automate repetitive tasks with rule-based automation.

### Automation Rules

| Trigger | Action |
|---------|--------|
| Card created | Auto-assign member |
| Card moved to list | Change due date |
| Due date passed | Move to list |
| Label added | Assign member |

### Implementation

```typescript
interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
}
```

### Implementation Files

- `frontend/src/components/AutomationRules.tsx` - Automation UI
- `web/modules/custom/boxtasks_automation/` - Backend automation

---

## Data Freshness Pattern

### Overview

Ensures UI always reflects the latest server state after mutations.

### Problem

When modals make API changes, parent component state becomes stale, causing changes to "disappear" when modal closes.

### Solution

Always refetch data after mutations:

```typescript
// Parent component
const { data, refetch } = useBoardData(boardId);

<BoardMembersModal
  onMembersChange={() => refetch()}  // Trigger parent refetch
/>

// Modal component
const handleAddMember = async () => {
  await addMember(userId);
  onMembersChange?.();  // Notify parent to refetch
};
```

### Alternative: Query Invalidation

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const handleUpdate = async () => {
  await updateData();
  // Invalidate queries to force refetch
  queryClient.invalidateQueries({ queryKey: ['board', boardId] });
};
```

---

## Custom Fields

### Overview

Add custom data fields to cards for additional tracking.

### Field Types

| Type | Description |
|------|-------------|
| Text | Single-line text input |
| Number | Numeric value |
| Date | Date picker |
| Dropdown | Single-select options |
| Checkbox | Boolean toggle |

### Implementation Files

- `frontend/src/components/CustomFieldsManager.tsx` - Field management
- `frontend/src/lib/api/customFields.ts` - Custom field API

---

## Mind Maps

### Overview

Visual brainstorming and planning tool integrated with boards.

### Features

- Create mind maps linked to boards
- Drag and drop nodes
- Export to image

### Implementation Files

- `frontend/src/components/MindMapsPanel.tsx` - Mind map panel
- `frontend/src/components/MindMapView.tsx` - Full mind map editor

---

## Board Chat

### Overview

Real-time chat functionality per board for team communication.

### Features

- Real-time messages via Mercure
- @mention support
- Message history
- Read indicators

### Implementation Files

- `frontend/src/components/ChatPanel.tsx` - Chat interface
- `frontend/src/lib/api/chat.ts` - Chat API

---

## Activity & Audit Logging

### Overview

Complete audit trail of all actions for compliance and debugging.

### Tracked Actions

- Card CRUD operations
- List changes
- Member additions/removals
- Permission changes
- Comments and mentions

### Activity Display

```typescript
const { display, icon } = getActivityDisplay(activity);
// Returns formatted message and appropriate icon
```

### Implementation Files

- `frontend/src/lib/api/activities.ts` - Activity API
- `frontend/src/components/ActivityFeed.tsx` - Activity display
- `web/modules/custom/boxtasks_audit/` - Backend audit logging
