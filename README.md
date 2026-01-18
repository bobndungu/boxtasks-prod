# BoxTasks - Task Management Application

A powerful, real-time task management application built with Drupal 11 backend and React frontend. BoxTasks provides Trello-like functionality with boards, lists, and cards, enhanced with real-time collaboration, role-based permissions, and a Progressive Web App (PWA) experience.

## Table of Contents

- [Features Overview](#features-overview)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Features Overview

### Core Features

- **Workspaces** - Organize boards into workspaces with team collaboration
- **Boards** - Kanban-style boards with customizable backgrounds
- **Lists** - Organize cards into draggable, sortable lists
- **Cards** - Rich task cards with descriptions, due dates, labels, and more
- **Real-time Collaboration** - Live updates via Mercure SSE
- **Role-based Permissions** - Granular access control per workspace

### Advanced Features

- **Multiple Views** - Kanban, Calendar, Timeline, Table, and Dashboard views
- **Custom Fields** - Add custom data fields to cards
- **Automation Rules** - Automate repetitive tasks
- **Mind Maps** - Visual brainstorming and planning
- **Advanced Filters** - Filter cards by labels, members, dates, and custom fields
- **Board Chat** - Real-time chat per board
- **Activity Feed** - Track all changes with detailed audit logs

### Progressive Web App (PWA)

- **Installable** - Install on desktop or mobile as a native-like app
- **Offline Support** - Continue working when offline
- **Auto-updates** - Automatic background updates with service worker
- **Push Notifications** - Real-time notification support

### Responsive Design

- **Mobile-first** - Optimized for all screen sizes
- **Adaptive UI** - Layout adjusts from mobile (< 640px) to desktop (1280px+)
- **Touch-friendly** - Drag and drop works on touch devices

---

## Tech Stack

### Backend (Drupal 11)

| Component | Technology |
|-----------|------------|
| CMS | Drupal 11 |
| API | JSON:API |
| Authentication | Simple OAuth 2.0 |
| Social Login | Google, Microsoft OAuth |
| Real-time | Mercure Hub |
| Database | MySQL 8.0 / MariaDB |
| Caching | Redis (optional) |

### Frontend (React)

| Component | Technology |
|-----------|------------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui + Radix UI |
| State Management | Zustand |
| Data Fetching | TanStack Query |
| Drag & Drop | dnd-kit |
| Routing | React Router v6 |
| PWA | vite-plugin-pwa + Workbox |
| Icons | Lucide React |

### Development Tools

| Tool | Purpose |
|------|---------|
| DDEV | Local development environment |
| TypeScript | Type safety |
| ESLint | Code linting |
| Prettier | Code formatting |

---

## Quick Start

### Prerequisites

- PHP 8.3+
- Node.js 18+
- Composer 2.x
- DDEV (for local development)

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/boxtasks2.git
cd boxtasks2

# Start DDEV
ddev start

# Install Drupal dependencies
ddev composer install

# Install frontend dependencies
cd frontend
npm install

# Start frontend dev server
npm run dev
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend (Dev) | http://localhost:5173 |
| Drupal Admin | https://boxtasks2.ddev.site/admin |
| JSON:API | https://boxtasks2.ddev.site/jsonapi |
| Production | https://tasks.boxraft.com |

---

## Project Structure

```
BoxTasks2/
├── frontend/                    # React frontend application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── board/           # Board-specific components
│   │   │   ├── ui/              # Base UI components (shadcn)
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── api/             # API client and hooks
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── stores/          # Zustand state stores
│   │   │   └── utils/           # Utility functions
│   │   ├── pages/               # Route page components
│   │   └── types/               # TypeScript type definitions
│   ├── public/                  # Static assets
│   └── dist/                    # Production build output
├── web/                         # Drupal webroot
│   ├── modules/custom/          # Custom Drupal modules
│   │   └── boxtasks_*/          # BoxTasks modules
│   ├── themes/                  # Drupal themes
│   └── sites/default/           # Drupal configuration
├── config/sync/                 # Drupal config export
├── docs/                        # Documentation
│   ├── DEPLOYMENT.md            # Deployment guide
│   ├── FEATURES.md              # Feature documentation
│   ├── ARCHITECTURE.md          # Technical architecture
│   └── ...
├── scripts/                     # Deployment and utility scripts
│   ├── deploy-to-production.sh
│   ├── sync-from-production.sh
│   └── production-hotfix.sh
└── CLAUDE.md                    # AI assistant instructions
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [FEATURES.md](docs/FEATURES.md) | Complete feature documentation |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture details |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment guide |
| [MICROSOFT_LOGIN_GUIDE.md](docs/MICROSOFT_LOGIN_GUIDE.md) | Microsoft OAuth setup |
| [schema_mapping.md](docs/schema_mapping.md) | Database schema mapping |

---

## Development

### Running Tests

```bash
# Frontend tests
cd frontend
npm run test

# Drupal tests
ddev drush test:run
```

### Code Style

```bash
# Frontend linting
cd frontend
npm run lint

# Drupal coding standards
ddev composer phpcs
```

### Building for Production

```bash
cd frontend
npm run build
```

### Deployment

Use the provided deployment scripts:

```bash
# Deploy to production
./scripts/deploy-to-production.sh

# Sync dev from production
./scripts/sync-from-production.sh
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

---

## Environment Variables

### Frontend (.env)

```bash
VITE_API_URL=https://boxtasks2.ddev.site
VITE_MERCURE_URL=https://boxtasks2.ddev.site/.well-known/mercure
VITE_OAUTH_CLIENT_ID=boxtasks_react
```

### Drupal (settings.php)

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for production environment configuration.

---

## Recent Updates

### v1.x - January 2026

- **Responsive Board Header** - Board name displays on its own line on mobile
- **PWA Auto-updates** - Service worker automatically updates in background
- **Improved Caching** - StaleWhileRevalidate strategy for faster loads
- **Board Member Management** - Assign roles and manage board-specific members
- **Data Freshness Pattern** - UI always reflects latest server state after mutations

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "feat: add my feature"`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Build/config changes

---

## License

Proprietary - All rights reserved.

---

## Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Production**: https://tasks.boxraft.com
