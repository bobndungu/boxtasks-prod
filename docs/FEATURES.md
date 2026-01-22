# BoxTasks Features Documentation

This document provides comprehensive documentation of all BoxTasks features, including how they work and how they are implemented.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Workspaces](#workspaces)
3. [Boards](#boards)
4. [Lists](#lists)
5. [Cards](#cards)
6. [Card Approvals](#card-approvals)
7. [Views](#views)
8. [Templates](#templates)
9. [Real-time Collaboration](#real-time-collaboration)
10. [Progressive Web App (PWA)](#progressive-web-app-pwa)
11. [Responsive Design](#responsive-design)
12. [Notifications](#notifications)
13. [Search & Filters](#search--filters)
14. [Automation](#automation)
15. [Custom Fields](#custom-fields)
16. [File Attachments](#file-attachments)
17. [Mind Maps](#mind-maps)
18. [Board Chat](#board-chat)
19. [Activity & Audit Logging](#activity--audit-logging)

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

### OAuth Email Verification

When users sign up via OAuth (Google/Microsoft), the system verifies that their email address matches an existing user account in the system. If no matching email is found, the login is rejected to prevent unauthorized access.

### OAuth Signup Approval Flow

New users signing up via OAuth go through an approval process:

1. **User Signs Up**: User authenticates with Google/Microsoft OAuth
2. **Pending Status**: Account is created with "pending" status
3. **Approval Modal**: User sees a "Pending Approval" modal on the homepage
4. **Admin Review**: Administrator reviews and approves/rejects the account
5. **Access Granted**: Once approved, user can access the system

Implementation files:
- `frontend/src/components/PendingApprovalModal.tsx` - Approval status modal
- `web/modules/custom/boxtasks_auth/` - Backend approval logic

### Role-Based Permissions

BoxTasks uses a comprehensive workspace role-based permission system. Permissions are defined per workspace role and checked in real-time.

#### Permission Categories

| Category | Permissions |
|----------|-------------|
| **Workspace** | View, Edit, Delete |
| **Board** | View, Create, Edit, Delete |
| **Card** | View, Create, Edit, Delete |
| **List** | Create, Edit, Delete |
| **Member** | View, Manage (add/remove) |
| **Role** | View, Edit (workspace roles), Board Role View |
| **Custom Fields** | View, Manage |
| **Automation** | View, Manage |
| **Card Fields** | View visibility of card field values |
| **Saved Views** | Create and manage saved views |
| **Mind Maps** | Create and manage mind maps |

#### Workspace Roles

Roles are defined per workspace and can have custom permissions:

| Default Role | Typical Permissions |
|--------------|---------------------|
| Admin | Full control over workspace |
| Editor | Create/edit boards, cards, lists |
| Viewer | Read-only access |
| Custom | Any combination of permissions |

#### Permission Checking

Permissions are checked via the `usePermissions` hook:

```typescript
const {
  canEdit,
  canDelete,
  canCreate,
  canManageMembers,
  canViewRoles,
  canManageCustomFields,
  canManageAutomation,
  canViewCardFields,
  canUseSavedViews,
  canUseMindMaps
} = usePermissions(workspaceId);

if (canEdit('card')) {
  // Show edit button
}

if (canManageCustomFields) {
  // Show custom fields menu
}
```

#### Real-time Permission Updates

When workspace roles are modified, permissions are synced in real-time:

1. Admin updates a workspace role's permissions
2. Backend publishes Mercure event to user-specific topic
3. Frontend receives event and invalidates permission cache
4. UI elements update immediately without page refresh

Implementation files:
- `frontend/src/lib/hooks/usePermissions.ts` - Permission checking hook
- `frontend/src/lib/api/roles.ts` - Permission cache management
- `frontend/src/components/GlobalWorkspaceSubscription.tsx` - Real-time sync

---

## Workspaces

### Overview

Workspaces are the top-level organizational unit containing boards and members.

### Features

- Create and manage workspaces
- Invite members with specific roles
- Workspace-level settings and permissions
- Activity feed for all workspace actions
- Membership-based access control
- Real-time membership updates

### Access Control

Workspaces use a strict membership-based access control system:

1. **Visibility**: Users can only see workspaces they are members of
2. **Member Roles**: Membership is tracked via `member_role` nodes
3. **Super Admin**: UID 1 (super admin) can access all workspaces
4. **Team Visibility**: Even "team" visibility workspaces require a `member_role`

#### How It Works

The access control is implemented at the Drupal node access level:

```php
// hook_node_access_records() - Define grants per workspace
// Each workspace gets a grant based on its node ID
$grants[] = [
  'realm' => 'boxtasks_workspace_member',
  'gid' => (int) $workspace->id(),
  'grant_view' => 1,
];

// hook_node_grants() - Give users grants based on memberships
// Users get grants only for workspaces they have member_roles for
$workspace_ids = _boxtasks_workspace_get_user_workspace_ids($user_id);
$grants['boxtasks_workspace_member'] = $workspace_ids;
```

This ensures that:
- Entity queries with `accessCheck(TRUE)` respect membership
- JSON:API endpoints automatically filter to accessible workspaces
- The "Everything" view only shows cards from accessible boards

#### Deleted Workspace Handling

The system gracefully handles deleted workspaces:
- Cached workspace references are auto-cleared if workspace no longer exists
- 404 errors are properly detected and handled
- Users are redirected to available workspaces

### Workspace Membership

Members are managed through `member_role` nodes rather than direct field references:

```typescript
interface MemberRole {
  id: string;
  userId: string;
  workspaceId: string;
  roleId: string;  // References workspace_role
}
```

Benefits:
- Each member can have a specific role in the workspace
- Role changes don't require modifying the workspace node
- Better audit trail of membership changes

### Real-time Membership Updates

When members are added or removed from a workspace:

1. Backend creates/deletes `member_role` node
2. Mercure event published to user-specific topic
3. Affected user's workspace list refreshes automatically
4. Permission cache is invalidated

Implementation in `GlobalWorkspaceSubscription.tsx`:
```typescript
useUserWorkspaceUpdates(user?.id, {
  onWorkspaceAssigned: () => refreshWorkspaces(),
  onWorkspaceUnassigned: () => refreshWorkspaces(),
});
```

### Data Model

```typescript
interface Workspace {
  id: string;
  title: string;
  description?: string;
  visibility: 'private' | 'team' | 'public';
  color: string;
  memberIds: string[];
  adminIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMember {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  memberRoleId?: string;  // The member_role node ID
  roleName?: string;      // Role name (Admin, Editor, etc.)
}
```

### Implementation Files

- `frontend/src/pages/WorkspaceView.tsx` - Workspace page
- `frontend/src/pages/WorkspaceSettings.tsx` - Workspace settings
- `frontend/src/lib/api/workspaces.ts` - API functions
- `frontend/src/components/WorkspaceSwitcher.tsx` - Workspace dropdown
- `frontend/src/components/GlobalWorkspaceSubscription.tsx` - Real-time updates
- `web/modules/custom/boxtasks_workspace/` - Node access control
- `web/modules/custom/boxtasks_role/` - Role management

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

### Board Visibility & Access Control

Boards support different visibility levels:

| Visibility | Access |
|------------|--------|
| `workspace` | All workspace members can view |
| `private` | Only board members and owner can view |

Access control is enforced at the node access level:
- Workspace-visible boards: Accessible to all workspace members
- Private boards: Only accessible to users in `field_board_members` or the board owner

### Board Role View Permission

A dedicated permission `boardRoleView` controls whether users can see board member roles:

```typescript
// Hide role dropdown if user lacks permission
if (!canViewBoardRoles) {
  // Only show member names, not their roles
}
```

This allows admins to hide role information from regular members.

### Data Model

```typescript
interface Board {
  id: string;
  title: string;
  background: string;
  workspaceId: string;
  visibility: 'workspace' | 'private';
  starred: boolean;
  members: BoardMember[];
  createdAt: string;
  updatedAt: string;
}

interface BoardMember {
  id: string;
  userId: string;
  displayName: string;
  role?: string;  // Only visible with boardRoleView permission
}
```

### Deleted Board Handling

The system gracefully handles deleted boards:
- 404 errors are detected and handled properly
- Users are redirected to workspace view
- Activity feeds skip deleted board references

### Implementation Files

- `frontend/src/pages/BoardView.tsx` - Main board view
- `frontend/src/components/board/` - Board sub-components
- `frontend/src/lib/api/boards.ts` - Board API functions
- `frontend/src/components/BoardSettingsModal.tsx` - Board settings
- `frontend/src/components/BoardMembersModal.tsx` - Member management
- `web/modules/custom/boxtasks_workspace/` - Board access control

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

## Card Approvals

### Overview

Cards can go through an approval workflow where designated approvers must approve or reject the card before it proceeds.

### Features

- Approval status tracking (pending, approved, rejected)
- Multiple approvers support
- Approval/rejection timestamps
- Approver/rejector information
- Real-time approval status updates via Mercure

### Approval Status

| Status | Description |
|--------|-------------|
| `pending` | Awaiting approval |
| `approved` | Approved by designated approver |
| `rejected` | Rejected by approver |
| `null` | No approval required |

### Data Model

```typescript
interface CardApproval {
  approvalStatus: 'pending' | 'approved' | 'rejected' | null;
  approvedBy?: {
    id: string;
    name: string;
  };
  approvedAt?: string;
  rejectedBy?: {
    id: string;
    name: string;
  };
  rejectedAt?: string;
}
```

### Real-time Updates

Approval status changes are broadcast via Mercure:

```typescript
// Event payload includes approval fields
{
  type: 'card:updated',
  payload: {
    id: 'card-uuid',
    approvalStatus: 'approved',
    approvedBy: { id: 'user-uuid', name: 'John Doe' },
    approvedAt: '2025-01-20T10:30:00Z'
  }
}
```

### Implementation Files

- `frontend/src/components/board/CardDetailModal.tsx` - Approval UI
- `web/modules/custom/boxtasks_card/` - Backend approval logic
- `web/modules/custom/boxtasks_realtime/` - Mercure serialization

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

Users can save view configurations (filters + view type) for quick access. Requires `savedViews` permission.

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

Access control:
```typescript
{canUseSavedViews && (
  <SavedViewsDropdown views={savedViews} onSelect={applySavedView} />
)}
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

## Templates

### Overview

Templates allow users to create reusable card structures with predefined content, checklists, labels, and custom fields.

### Features

- Create templates from existing cards
- Board-scoped and workspace-scoped templates
- Template management (edit, archive, delete)
- Role-based permissions for template access
- Custom title required when creating from template

### Template Scope

Templates can be scoped at different levels:

| Scope | Access |
|-------|--------|
| `board` | Only available within the specific board |
| `workspace` | Available across all boards in the workspace |

```typescript
interface Template {
  id: string;
  title: string;
  description?: string;
  scope: 'board' | 'workspace';
  boardId?: string;      // For board-scoped templates
  workspaceId: string;
  checklists: TemplateChecklist[];
  labels: string[];
  customFields: TemplateCustomField[];
  createdBy: string;
  createdAt: string;
}
```

### Template Management

Templates support full CRUD operations with role-based access:

| Action | Required Permission |
|--------|---------------------|
| View templates | `templateView` or board member |
| Create template | `templateCreate` |
| Edit template | `templateEdit` or template owner |
| Delete template | `templateDelete` or template owner |
| Archive template | `templateEdit` |

### Creating Cards from Templates

When creating a card from a template:

1. User selects template from dropdown
2. **Custom title is required** - cannot use template title directly
3. Template content is copied to new card
4. Checklists, labels, and custom fields are duplicated
5. Card creator is shown correctly (not "Unknown User")

```typescript
// Creating card from template
const handleCreateFromTemplate = async (templateId: string, customTitle: string) => {
  await createCardFromTemplate({
    templateId,
    title: customTitle,  // Required custom title
    listId: selectedList.id,
  });
};
```

### Implementation Files

- `frontend/src/components/TemplateManager.tsx` - Template list and management
- `frontend/src/components/CreateTemplateModal.tsx` - Create template dialog
- `frontend/src/components/EditTemplateModal.tsx` - Edit template dialog
- `frontend/src/lib/api/templates.ts` - Template API functions
- `web/modules/custom/boxtasks_template/` - Backend template logic

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
| `card:updated` | Card modified (includes approval status) |
| `card:deleted` | Card removed |
| `card:moved` | Card moved between lists |
| `list:created` | New list added |
| `list:updated` | List modified |
| `comment:created` | New comment added |
| `member:joined` | User joined board |
| `member:left` | User left board |
| `customField:updated` | Custom field value changed |
| `workspace:assigned` | User added to workspace |
| `workspace:unassigned` | User removed from workspace |
| `permissions:updated` | Workspace role permissions changed |

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

### Global Workspace Subscription

A global subscription component handles workspace-level real-time updates:

```typescript
// GlobalWorkspaceSubscription.tsx
export default function GlobalWorkspaceSubscription() {
  const { user } = useAuthStore();

  // Subscribe to workspace assignment changes
  useUserWorkspaceUpdates(user?.id, {
    onWorkspaceAssigned: () => refreshWorkspaces(),
    onWorkspaceUnassigned: () => refreshWorkspaces(),
  });

  // Subscribe to permission changes
  useUserPermissionUpdates(user?.id, {
    onPermissionsUpdated: () => invalidatePermissionCache(),
  });

  return null;
}
```

This ensures:
- Workspace list updates when user is added/removed from workspaces
- Permissions refresh when workspace roles are modified
- No need for page refresh to see changes

### Custom Field Real-time Updates

Custom field values sync in real-time:

1. User updates a custom field value on a card
2. Backend saves and publishes Mercure event
3. All connected clients receive the update
4. Card modal syncs the custom field display
5. Field order stays consistent between manager and modal

### Implementation Files

- `frontend/src/lib/hooks/useMercure.ts` - Mercure subscription hook
- `frontend/src/lib/hooks/usePresence.ts` - User presence tracking
- `frontend/src/components/ConnectionStatus.tsx` - Connection indicator
- `frontend/src/components/ActiveUsers.tsx` - Active users display
- `frontend/src/components/GlobalWorkspaceSubscription.tsx` - Global subscriptions

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

### Development Mode

Service worker caching is **disabled in development mode** to prevent stale code issues:

```typescript
// vite.config.ts
VitePWA({
  // Only enable in production
  devOptions: {
    enabled: false,  // Disabled to prevent caching issues during development
  },
  // ...
})
```

This prevents:
- Stale JavaScript being served after code changes
- Confusion when changes don't appear immediately
- Need to manually clear browser cache during development

### Production Caching Fixes

Several fixes ensure proper cache management in production:

1. **HTTP Headers for Cache Control**: Uses proper Cache-Control headers instead of URL query parameters
2. **Service Worker Skip Waiting**: New service worker versions activate immediately
3. **Cache Busting**: Permission API calls include cache-busting headers

```typescript
// Example: Fetching permissions with cache control
const response = await fetch(url, {
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
});
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

BoxTasks provides in-app and email notifications for important events.

### Notification Types

| Type | Trigger |
|------|---------|
| @mention | User mentioned in comment |
| Assignment | Card assigned to user |
| Due date | Card due date approaching or overdue |
| Comment | New comment on watched card |
| Approval | Card approval status changed |

### Email Notifications

Email notifications include:

- **Configurable Frontend URL**: The frontend URL in email links is configurable via environment variable
- **UUID-based Card URLs**: Card links use UUIDs instead of node IDs for cleaner URLs
- **Proper Overdue Text**: Corrected notification text (e.g., "is overdue" instead of "is due now overdue")
- **HTML Entity Decoding**: Special characters are properly decoded in email content
- **Lucide Icons**: Modern Lucide icons used for notification types

Configuration:
```env
# .env
FRONTEND_URL=https://tasks.boxraft.com
```

### Notification Display

- Clickable timestamps that link to the relevant card
- Activity details shown inline where applicable
- Comment content previews in activity feeds

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
- `web/modules/custom/boxtasks_notification/` - Backend notification logic

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

Automate repetitive tasks with rule-based automation. Requires `automationManage` permission to access.

### Access Control

The Automation Rules menu is only visible to users with the `automationManage` permission:

```typescript
// Hide automation if user lacks permission
{canManageAutomation && (
  <MenuItem icon={Zap} label="Automation" onClick={openAutomation} />
)}
```

### Automation Rules

| Trigger | Action |
|---------|--------|
| Card created | Auto-assign member |
| Card moved to list | Change due date |
| Due date passed | Move to list |
| Label added | Assign member |
| Due date condition met | Various actions |

### Triggers

Available triggers for automation rules:

| Trigger | Description |
|---------|-------------|
| `card_created` | When a new card is created |
| `card_moved` | When a card is moved to a specific list |
| `due_date` | When due date meets a condition |
| `label_added` | When a specific label is added |
| `label_removed` | When a specific label is removed |
| `member_assigned` | When a member is assigned |
| `checklist_completed` | When all checklist items are complete |

### Conditions

#### Due Date Condition with Comparison Operators

The due date condition supports multiple comparison operators:

| Operator | Description |
|----------|-------------|
| `before` | Due date is before specified date |
| `after` | Due date is after specified date |
| `on` | Due date is exactly on specified date |
| `within_days` | Due date is within X days from now |
| `overdue` | Due date has passed |
| `no_due_date` | Card has no due date set |

```typescript
interface DueDateCondition {
  type: 'due_date';
  operator: 'before' | 'after' | 'on' | 'within_days' | 'overdue' | 'no_due_date';
  value?: string;  // Date string for before/after/on
  days?: number;   // Number of days for within_days
}
```

### Retroactive Option

Automation rules can optionally apply to existing cards:

```typescript
interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  applyRetroactively: boolean;  // Apply to existing cards
  retroactiveExecuted: boolean; // Track if already executed
}
```

When creating or enabling a rule with `applyRetroactively: true`:
1. The rule evaluates against all existing cards on the board
2. Actions are executed for cards that match conditions
3. `retroactiveExecuted` is set to `true` to prevent duplicate execution
4. A checkbox in the UI controls this option

### Implementation

```typescript
interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  applyRetroactively: boolean;
  retroactiveExecuted: boolean;
}
```

### Implementation Files

- `frontend/src/components/AutomationRules.tsx` - Automation UI
- `frontend/src/components/AutomationRuleEditor.tsx` - Rule editor
- `web/modules/custom/boxtasks_automation/` - Backend automation
- `web/modules/custom/boxtasks_automation/src/Service/` - Automation services

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

Add custom data fields to cards for additional tracking. Requires `customFieldsManage` permission to manage fields.

### Access Control

The Custom Fields menu is only visible to users with the `customFieldsManage` permission:

```typescript
// Hide custom fields if user lacks permission
{canManageCustomFields && (
  <MenuItem icon={Settings} label="Custom Fields" onClick={openCustomFields} />
)}
```

### Field Types

| Type | Description |
|------|-------------|
| Text | Single-line text input |
| Number | Numeric value |
| Date | Date picker |
| Dropdown | Single-select options |
| Checkbox | Boolean toggle |
| Multi-select | Multiple option selection |

### Visibility System

Custom fields have an advanced visibility system:

#### Default Hidden in Board View

By default, custom fields are **hidden** in the board view (card previews). This keeps cards clean and focused on essential information.

```typescript
interface CustomFieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  showInBoardView: boolean;  // Default: false
  // ...
}
```

#### Card Fields Visibility Permission

A permission `cardFieldsVisibility` controls whether users can see custom field values:

- Users without this permission cannot see custom field values on cards
- The Custom Fields section is hidden in the card modal for these users
- Admins can grant this permission per workspace role

### Field Order Synchronization

Custom field order is synchronized between:
- The Custom Fields Manager (where fields are defined)
- The Card Detail Modal (where values are entered)

When field order is changed in the manager, it automatically updates in card modals.

### Real-time Updates

Custom field values sync in real-time via Mercure:

1. User updates a custom field value
2. Backend publishes `customField:updated` event
3. All connected clients receive the update
4. Card modal refreshes the field value
5. No duplicate field displays

```typescript
// Mercure event for custom field update
{
  type: 'customField:updated',
  payload: {
    cardId: 'card-uuid',
    fieldId: 'field-uuid',
    value: 'new value'
  }
}
```

### Implementation Files

- `frontend/src/components/CustomFieldsManager.tsx` - Field management
- `frontend/src/components/CustomFieldsSection.tsx` - Card modal section
- `frontend/src/lib/api/customFields.ts` - Custom field API
- `web/modules/custom/boxtasks_customfield/` - Backend custom field logic

---

## File Attachments

### Overview

Cards support file attachments with a custom upload API for reliable file handling.

### Features

- Multiple file upload
- File type validation
- Progress indicators
- Thumbnail previews for images
- Download links

### Custom Upload API

A dedicated file upload endpoint handles attachments:

```typescript
// Upload endpoint: POST /api/card/{cardId}/attachments
const uploadAttachment = async (cardId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/card/${cardId}/attachments`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
};
```

Benefits of custom endpoint:
- Better error handling
- Directory creation with fallback
- Proper file permissions
- Progress tracking support

### Implementation Files

- `frontend/src/components/AttachmentsSection.tsx` - Attachment UI
- `frontend/src/lib/api/attachments.ts` - Attachment API
- `web/modules/custom/boxtasks_attachment/` - Backend attachment logic

---

## Mind Maps

### Overview

Visual brainstorming and planning tool integrated with boards. Requires `mindMaps` permission to access.

### Access Control

Mind Maps are only accessible to users with the `mindMaps` permission:

```typescript
{canUseMindMaps && (
  <ViewOption icon={Network} label="Mind Map" onClick={() => setView('mindmap')} />
)}
```

### Features

- Create mind maps linked to boards
- Drag and drop nodes
- Connect nodes with relationships
- Color-coded nodes
- Export to image
- Real-time collaboration

### Implementation Files

- `frontend/src/components/MindMapsPanel.tsx` - Mind map panel
- `frontend/src/components/MindMapView.tsx` - Full mind map editor
- `web/modules/custom/boxtasks_mindmap/` - Backend mind map logic

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
- Approval status changes
- Custom field modifications
- Workspace membership changes

### Activity Display

Activities are displayed with:
- **Clickable timestamps** that link to the relevant card
- **Comment previews** inline in the activity feed
- **Lucide icons** for visual identification of action types

```typescript
const { display, icon } = getActivityDisplay(activity);
// Returns formatted message and appropriate icon
```

### Dashboard Activity

The dashboard activity feed:
- Shows activities from all accessible boards
- Timestamps are clickable and link to the card
- Comments are displayed inline
- Deleted cards/boards are handled gracefully (skip missing references)

### Implementation Files

- `frontend/src/lib/api/activities.ts` - Activity API
- `frontend/src/components/ActivityFeed.tsx` - Activity display
- `frontend/src/pages/Dashboard.tsx` - Dashboard activity feed
- `web/modules/custom/boxtasks_activity/` - Backend activity logging

---

## Changelog

### January 2025

#### Access Control
- **Workspace/Board Visibility**: Users can now only see workspaces and boards they are members of (via `member_role` nodes)
- **Node Access Grants**: Implemented `hook_node_access_records()` and `hook_node_grants()` for proper entity query filtering
- **Board Role View Permission**: New permission to control visibility of board member roles

#### Automation
- **Retroactive Option**: Automation rules can now optionally apply to existing cards
- **Due Date Comparison Operators**: Enhanced due date conditions with `before`, `after`, `on`, `within_days`, `overdue`, and `no_due_date` operators

#### Custom Fields
- **Default Hidden in Board View**: Custom fields are now hidden by default in card previews
- **Card Fields Visibility Permission**: New permission to control who can see custom field values
- **Real-time Updates**: Custom field values now sync in real-time via Mercure
- **Field Order Sync**: Field order stays consistent between manager and card modal

#### Templates
- **Board Scope Option**: Templates can now be scoped to a specific board or workspace-wide
- **Template Management**: Full CRUD operations with edit, archive, and delete
- **Required Custom Title**: Creating cards from templates now requires a custom title

#### Permissions
- **New Permission Categories**: Added permissions for Custom Fields, Automation, Card Fields Visibility, Saved Views, and Mind Maps
- **Real-time Permission Sync**: Permissions update in real-time when workspace roles are modified
- **Global Workspace Subscription**: Automatic workspace list refresh when membership changes

#### Notifications
- **Configurable Frontend URL**: Email notification links use configurable frontend URL
- **UUID-based Card URLs**: Card links in emails use UUIDs instead of node IDs
- **Improved Text**: Fixed "is due now overdue" to "is overdue"

#### File Attachments
- **Custom Upload API**: New dedicated endpoint for card file attachments
- **Directory Creation**: Improved directory creation with fallback handling

#### OAuth & Authentication
- **Email Verification**: OAuth login rejected if email doesn't match existing user
- **Signup Approval Flow**: New users via OAuth require admin approval

#### Real-time Collaboration
- **Custom Field Events**: New `customField:updated` Mercure event type
- **Permission Events**: New `permissions:updated` event for real-time permission sync
- **Workspace Events**: New `workspace:assigned` and `workspace:unassigned` events

#### PWA & Caching
- **Development Mode Fix**: Service worker caching disabled in development
- **Production Caching Fixes**: Improved cache control headers and cache busting

#### Card Approvals
- **Approval Workflow**: Cards can now go through approval/rejection workflow
- **Approval Fields**: Added `approvalStatus`, `approvedBy`, `approvedAt`, `rejectedBy`, `rejectedAt` fields
- **Real-time Approval Updates**: Approval status changes broadcast via Mercure

#### Bug Fixes
- Deleted boards/cards handled gracefully with 404 detection
- Auto-clear cached workspace if it no longer exists
- Everything tab only shows cards from accessible boards
- Workspace members read from `member_role` nodes instead of field
- Card creator shown correctly when creating from templates
- UID 1 (super admin) filtered from workspace member counts and lists
