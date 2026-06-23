# Varta - The Communication Engine

Varta is a unified communication engine combining Notifications, Real-time Chat, and Email features. The app manages workspaces, subscribers, templates, routing rules, delivery workflows, analytics, and an embeddable React inbox package.

## Product Context

- Workspaces own provider configuration, API keys, limits, and tenant settings.
- Subscribers store contact channels, preferences, locale, timezone, and attributes.
- Templates define email, in-app, push, and webhook payloads.
- Workflows and rules decide when and where notifications are delivered.
- The React package exposes an inbox-style client integration.

## Tech Stack

- Frontend: Next.js 16 App Router, React 19, TypeScript 6, CSS Modules, NextAuth.
- Backend: Express 5, TypeScript 6, Helmet, CORS, feature-based API modules.
- Data: PostgreSQL via Prisma, MongoDB/Mongoose-ready document models, Redis for queues/realtime.
- Packages: pnpm workspaces for `client`, `server`, `packages/db`, and `packages/react`.
- Infra: Docker Compose, Nginx reverse proxy, Prometheus/Grafana starter observability under `infra`.

## Repository Layout

```text
client/       Next.js web app
server/       Express API service
packages/     Shared workspace packages
infra/        Docker, Compose, Nginx, monitoring, observability
docs/         Architecture and operating notes
```

## Development

```bash
pnpm install
pnpm dev
```

Run infra dependencies:

```bash
pnpm infra:up
```

Build all workspaces:

```bash
pnpm build
```
