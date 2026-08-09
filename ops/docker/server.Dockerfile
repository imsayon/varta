# BUILD
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

RUN npm install --global pnpm@11.20.0

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --filter @varta/server...

COPY server/ ./server/
WORKDIR /app/server
RUN pnpm prisma:generate \
  && pnpm build \
  && pnpm --filter @varta/server deploy --prod --legacy /prod/server \
  && cd /prod/server \
  && /app/server/node_modules/.bin/prisma generate

# RUN
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

LABEL org.opencontainers.image.authors="Sayon sayn731@gmail.com"
LABEL org.opencontainers.image.source="https://github.com/imsayon/varta"

ENV NODE_ENV=production
WORKDIR /app/server

RUN addgroup -S varta && adduser -S varta -G varta

COPY --from=build /prod/server/ ./

RUN chown -R varta:varta /app

USER varta
EXPOSE 5000 5001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
