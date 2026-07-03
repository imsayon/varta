# Varta

> **वार्ता** — A self-hostable, multi-tenant notification infrastructure platform with an AI intelligence layer.

Trigger notifications across email, in-app, and webhooks from a single API — with AI-powered send-time optimization and natural language routing rules.

## Tech Stack

| Layer        | Technology                                                           |
| ------------ | -------------------------------------------------------------------- |
| **Frontend** | Next.js 16, React 19, TypeScript 6, CSS Modules, Zustand             |
| **Backend**  | Express 5, TypeScript 6, Prisma 7, Zod 4                             |
| **Database** | PostgreSQL (pgvector), Redis                                         |
| **Queue**    | BullMQ                                                               |
| **Auth**     | JWT (ES256) + refresh token rotation, OAuth (Google, GitHub), argon2 |
| **Email**    | Resend                                                               |
| **Infra**    | Docker Compose, GitHub Actions CI                                    |

## Repository Layout

```
.github/       GitHub Actions workflows
server/        Express API (src/modules, src/common, src/infra)
client/        Next.js dashboard (src/app, src/features, src/shared)
infra/         Docker Compose, Dockerfiles
```

## Development

```bash
# Server
cd server && pnpm install && pnpm dev

# Client
cd client && pnpm install && pnpm dev
```

Server runs on `http://localhost:5000`, client on `http://localhost:3000`.
Client proxies `/api/v1/*` to the server via Next.js rewrites.

## Current Phase

**Phase 0 — Foundation** ✅ Complete

Full auth system (credentials + OAuth), Prisma schema, Express middleware stack, CI pipeline, dashboard shell with auth-gated routing.
