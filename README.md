# Varta

Self-hostable, multi-tenant notification infrastructure.

## Repo

- `server/` Express API, Prisma, Redis, BullMQ workers
- `client/` Next.js dashboard
- `infra/` local Docker artifacts

## Setup

```bash
cd server
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:push
pnpm dev
```

```bash
cd client
pnpm install
pnpm dev
```

Server default: `http://localhost:5000`
Client default: `http://localhost:3000`

## Checks

```bash
cd server && pnpm typecheck && pnpm build
cd client && pnpm exec tsc --noEmit && pnpm lint && pnpm build
```
