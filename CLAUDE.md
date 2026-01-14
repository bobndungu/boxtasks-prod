# BoxTasks2 Agentic Loop Instructions

## Project Context

This is a rebuild of BoxTasks (~/Sites/DrupalDev/BoxTasks/) using:
- **Backend**: Drupal 11 with JSON:API
- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui
- **Local Dev**: DDEV
- **Real-time**: Mercure
- **Data Source**: Production database at tasks.boxraft.com (SSH tunnel)

Reference the original BoxTasks code at ~/Sites/DrupalDev/BoxTasks/ for:
- Database schema: packages/database/schema.sql
- Type definitions: packages/shared/src/types/index.ts
- API patterns: apps/api/src/routes/
- UI components: apps/web/src/lib/components/

---

## Session Start Protocol

On EVERY session, do this FIRST:

1. Check if `feature_list.json` exists
   - NO: Run **INITIALIZER MODE**
   - YES: Run **CODING AGENT MODE**

2. Read recent git log (last 5 commits) for context

3. Check service status:
   - `ddev describe` for Drupal backend
   - Check if frontend dev server is running

---

## INITIALIZER MODE (First Session Only)

Execute when `feature_list.json` does NOT exist:

### Step 1: Read Requirements
- Read `app_spec.txt` thoroughly
- Read original BoxTasks source for reference patterns

### Step 2: Create Feature List
Create `feature_list.json` with structure:
```json
{
  "project": "BoxTasks2",
  "dev_servers": {
    "drupal": {
      "command": "ddev start",
      "url": "https://boxtasks2.ddev.site"
    },
    "frontend": {
      "command": "cd frontend && npm run dev",
      "url": "http://localhost:5173"
    }
  },
  "features": [
    {
      "id": 1,
      "name": "Feature name",
      "test": "How to test it",
      "status": "pending",
      "type": "drupal|react|both"
    }
  ],
  "current_feature": null,
  "browser_retries": 0,
  "phase": "infrastructure"
}
```

### Step 3: Set Up DDEV Drupal Project

```bash
# Initialize DDEV
ddev config --project-type=drupal11 --docroot=web --php-version=8.3

# Start DDEV
ddev start

# Create Drupal project
ddev composer create drupal/recommended-project:^11 --no-install

# Install Drupal
ddev composer install

# Install Drush
ddev composer require drush/drush

# Site install
ddev drush site:install standard --site-name="BoxTasks2" --account-name=admin --account-pass=admin -y

# Enable required modules
ddev drush en jsonapi jsonapi_extras simple_oauth consumers serialization rest -y

# Configure CORS
ddev drush config:set system.site page.front /jsonapi -y
```

### Step 4: Set Up React Frontend

```bash
# Create frontend directory
mkdir frontend
cd frontend

# Initialize with Vite
npm create vite@latest . -- --template react-ts

# Install dependencies
npm install

# Install Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install shadcn/ui dependencies
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu

# Install API/state management
npm install @tanstack/react-query zustand axios

# Install drag-and-drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Install routing
npm install react-router-dom

# Install real-time (Mercure)
npm install event-source-polyfill
```

### Step 5: Configure Base Files

Create essential config files:
- `frontend/tailwind.config.js` with shadcn/ui config
- `frontend/src/lib/utils.ts` with cn helper
- `frontend/src/lib/api/client.ts` for Drupal JSON:API
- `frontend/.env` with API URL

### Step 6: Initial Git Commit

```bash
git init
git add -A
git commit -m "chore: initialize BoxTasks2 with Drupal 11 and React"
```

### Step 7: Verify Setup

1. Start services:
   ```bash
   ddev start
   cd frontend && npm run dev &
   ```

2. Test Drupal:
   - browser_navigate to https://boxtasks2.ddev.site/jsonapi
   - browser_snapshot to verify JSON:API response

3. Test Frontend:
   - browser_navigate to http://localhost:5173
   - browser_snapshot to verify React app loads

4. If fails: Apply BROWSER RECOVERY

### Step 8: Begin First Feature
Proceed to CODING AGENT MODE

---

## CODING AGENT MODE (All Sessions)

Execute when `feature_list.json` EXISTS:

### Step 1: Load State
- Read `feature_list.json`
- Find first feature with status "pending" or "in_progress"
- If all features "completed": Output "ALL FEATURES COMPLETE" and stop

### Step 2: Start Dev Servers
```bash
# Start Drupal if not running
ddev start

# Start frontend if not running
cd frontend && npm run dev &

# Wait for ready
sleep 5
```

### Step 3: Baseline Test
- browser_navigate to the relevant URL (Drupal or frontend)
- browser_snapshot
- If fails: Apply BROWSER RECOVERY

### Step 4: Implement Feature

Based on feature type:

**For "drupal" features:**
- Create/modify Drupal modules, content types, fields
- Use Drush for configuration
- Export config: `ddev drush cex -y`
- Reference: /web/modules/custom/

**For "react" features:**
- Create/modify React components
- Use TypeScript strictly
- Reference: /frontend/src/

**For "both" features:**
- Implement Drupal backend first
- Then implement React frontend
- Test integration

Update feature status to "in_progress" in feature_list.json

### Step 5: Test Feature

**For Drupal features:**
1. browser_navigate to https://boxtasks2.ddev.site/jsonapi/[endpoint]
2. browser_snapshot to verify API response
3. Or use `ddev drush` commands to verify

**For React features:**
1. browser_navigate to http://localhost:5173/[route]
2. browser_snapshot to see the UI
3. browser_click or browser_type to test interactions
4. browser_snapshot to verify result

**For integration:**
1. Test API in Drupal
2. Test UI in React
3. Verify data flows correctly

### Step 6: Handle Test Result

**If test PASSES:**
- Update feature status to "completed" in feature_list.json
- Reset browser_retries to 0
- Export Drupal config if changed: `ddev drush cex -y`
- Git commit:
  ```bash
  git add -A
  git commit -m "feat: [feature name]"
  ```
- Output: "Feature X completed. Continuing to next feature..."
- Go to Step 1

**If test FAILS:**
- Increment browser_retries in feature_list.json
- Apply BROWSER RECOVERY
- If browser_retries >= 4: Go to STOP PROTOCOL

---

## BROWSER RECOVERY PROTOCOL

When browser tests fail or browser is unresponsive:

```
1. browser_close
2. browser_wait_for with time: 5
3. browser_navigate to the appropriate URL
4. browser_snapshot

If snapshot succeeds:
   - Continue with testing

If snapshot fails:
   - Increment browser_retries
   - If browser_retries < 3: Repeat from step 1
   - If browser_retries >= 3: Force restart browser processes
   - If browser_retries >= 4: Go to STOP PROTOCOL
```

---

## STOP PROTOCOL

When browser fails 4 times:

1. Update feature_list.json:
   - Set current feature status to "blocked"
   - Add "blocked_reason": "Browser test failed after 4 retries"

2. Git commit:
   ```bash
   git add -A
   git commit -m "chore: mark feature as blocked - browser failure"
   ```

3. Output this EXACT message:
   ```
   ========================================
   AGENTIC LOOP STOPPED

   Reason: Browser test failed after 4 retries
   Blocked Feature: [feature name]

   To resume:
   1. Fix the browser/test issue manually
   2. Run: ./run-agent.sh
   ========================================
   ```

4. STOP - Do not continue

---

## Drupal Development Patterns

### Creating Content Types

Use Drush and config export:
```bash
# Create content type via Drush or UI
ddev drush generate content-type

# Export config
ddev drush cex -y
```

Or create programmatically in custom module.

### Custom Module Structure

```
web/modules/custom/boxtasks_core/
├── boxtasks_core.info.yml
├── boxtasks_core.module
├── boxtasks_core.install
├── src/
│   ├── Controller/
│   ├── Entity/
│   ├── Form/
│   └── Plugin/
└── config/
    └── install/
```

### JSON:API Customization

Extend JSON:API with jsonapi_extras or custom resources:
```php
// Custom resource at /jsonapi/custom/endpoint
```

### Authentication (Simple OAuth)

```bash
ddev drush en simple_oauth consumers -y
# Configure OAuth clients via admin UI
```

---

## React Development Patterns

### Component Structure

```
frontend/src/
├── components/
│   ├── ui/           # shadcn/ui base components
│   ├── board/        # Board-related components
│   ├── card/         # Card components
│   └── layout/       # Layout components
├── lib/
│   ├── api/          # API client and hooks
│   ├── stores/       # Zustand stores
│   └── utils/        # Utility functions
├── pages/            # Route pages
└── types/            # TypeScript types
```

### API Client Pattern

```typescript
// frontend/src/lib/api/client.ts
const API_BASE = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

export async function jsonApiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}/jsonapi/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      ...options?.headers,
    },
  });
  return response.json();
}
```

### TanStack Query Hooks

```typescript
// frontend/src/lib/api/hooks/useBoards.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export function useBoards(workspaceId: string) {
  return useQuery({
    queryKey: ['boards', workspaceId],
    queryFn: () => fetchBoards(workspaceId),
  });
}
```

---

## Mercure Real-time Pattern

### Drupal Publisher

```php
// Publish updates via Mercure
use Symfony\Component\Mercure\Update;
use Symfony\Component\Mercure\HubInterface;

$update = new Update(
    'https://boxtasks2.ddev.site/boards/{id}',
    json_encode(['type' => 'card:updated', 'data' => $card])
);
$hub->publish($update);
```

### React Subscriber

```typescript
// frontend/src/lib/mercure/useSubscription.ts
export function useMercureSubscription(topic: string, onMessage: (data: any) => void) {
  useEffect(() => {
    const url = new URL(MERCURE_URL);
    url.searchParams.append('topic', topic);

    const eventSource = new EventSource(url, { withCredentials: true });
    eventSource.onmessage = (e) => onMessage(JSON.parse(e.data));

    return () => eventSource.close();
  }, [topic, onMessage]);
}
```

---

## Data Migration Notes

### SSH Tunnel to Production

```bash
# Open SSH tunnel to tasks.boxraft.com
ssh -L 3307:localhost:3306 user@tasks.boxraft.com

# Then connect via localhost:3307
```

### Migration Approach

1. Export data from production MySQL
2. Transform to Drupal entity structure
3. Import via Drupal Migration API or custom scripts
4. Verify data integrity

### Drupal Migrate API

```yaml
# config/install/migrate_plus.migration.boxtasks_users.yml
id: boxtasks_users
source:
  plugin: mysql
  host: localhost
  port: 3307
  database: boxtasks_prod
  query: SELECT * FROM users
process:
  uid: id
  name: email
  mail: email
destination:
  plugin: entity:user
```

---

## Rules

1. **ONE FEATURE AT A TIME** - Never implement multiple features at once
2. **ALWAYS TEST** - Every feature must be tested with Playwright before marking complete
3. **ALWAYS COMMIT** - Git commit after every completed feature
4. **NEVER SKIP TESTS** - If tests fail, fix or mark as blocked
5. **BROWSER MUST WORK** - Follow recovery protocol; stop after 4 failures
6. **READ STATE FIRST** - Always read feature_list.json at session start
7. **MINIMAL CHANGES** - Only change what's needed for the current feature
8. **EXPORT DRUPAL CONFIG** - Always run `ddev drush cex -y` after Drupal changes
9. **REFERENCE ORIGINAL** - Check ~/Sites/DrupalDev/BoxTasks/ for patterns
10. **TYPE SAFETY** - Use TypeScript strictly in React code

---

## Playwright MCP Commands Reference

```
browser_navigate     - Go to URL
browser_snapshot     - Get page accessibility tree (PREFERRED)
browser_click        - Click element (needs ref from snapshot)
browser_type         - Type into input (needs ref from snapshot)
browser_press_key    - Press keyboard key
browser_close        - Close browser
browser_wait_for     - Wait for text or time
browser_take_screenshot - Visual screenshot
browser_console_messages - Check JS console
```

### Typical Test Sequence:
1. browser_navigate to page
2. browser_snapshot to see elements and get refs
3. browser_click or browser_type using refs from snapshot
4. browser_snapshot again to verify result

---

## Resume Commands

After stopping, resume with:
```bash
# Using the script
./run-agent.sh

# Or manually
claude --continue "Resume the agentic loop from where we left off"
```

---

## Important URLs

- Drupal Admin: https://boxtasks2.ddev.site/admin (admin/admin)
- Drupal JSON:API: https://boxtasks2.ddev.site/jsonapi
- React Frontend: http://localhost:5173
- Original BoxTasks: ~/Sites/DrupalDev/BoxTasks/
- Production DB: tasks.boxraft.com (SSH tunnel)

---

## Production Server Configuration

### Server Access
- **SSH Host:** 23.92.21.181
- **SSH User:** root
- **SSH Port:** 22
- **Production URL:** https://boxtasks.boxraft.com
- **Drupal Path:** /var/www/websites/boxtasks.boxraft.com/web

### CRITICAL: Shared Services Warning

**DO NOT override secrets for existing shared services on the production server.**

The production server hosts multiple websites that share these services:
- **Database (MySQL/MariaDB)** - Other sites use the same database server
- **Redis** - Shared cache service with existing password
- **Mercure** - May be shared with other sites
- **SMTP** - Shared mail configuration

**When deploying BoxTasks2:**
1. **GET existing credentials** from the server for shared services (DB, Redis, Mercure, SMTP)
2. **DO NOT generate new passwords** for shared services - this will break other sites
3. **Only use generated secrets** for BoxTasks2-specific configuration:
   - `DRUPAL_HASH_SALT` (BoxTasks2 specific)
   - `DRUPAL_ADMIN_PASSWORD` (BoxTasks2 specific)
   - `VITE_OAUTH_CLIENT_SECRET` (BoxTasks2 specific)

### Production Configuration File

All production configuration is in: `.env.production.local` (gitignored)

Fields marked `<FILL_IN>` must be obtained from the existing server configuration.

### Deployment Checklist

Before deploying to production:
- [ ] Get existing DB credentials from server
- [ ] Get existing Redis password from server
- [ ] Get existing Mercure JWT secret from server (if shared)
- [ ] Get existing SMTP password from server
- [ ] Regenerate Google OAuth secret (in Google Console)
- [ ] Regenerate Microsoft OAuth secret (in Azure Portal)
- [ ] Set BoxTasks2-specific secrets (hash salt, admin password, OAuth client secret)
- [ ] Test all authentication flows after deployment
