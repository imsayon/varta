FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and Prisma schema
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build TypeScript
RUN pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma

# Install production dependencies only
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Generate Prisma client for production
RUN pnpm prisma:generate

EXPOSE 5000

CMD ["node", "dist/server.js"]
