# BUILD
FROM node:24.18.0-alpine AS build

RUN npm install --global pnpm@11.20.0

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --filter @varta/server...

COPY server/ ./server/
WORKDIR /app/server
RUN pnpm prisma:generate \
  && pnpm build \
  && CI=true pnpm prune --prod \
  && node node_modules/prisma/build/index.js generate

# RUN
FROM node:24.18.0-alpine AS runtime

LABEL org.opencontainers.image.authors="Sayon sayn731@gmail.com"
LABEL org.opencontainers.image.source="https://github.com/imsayon/varta"

ENV NODE_ENV=production
WORKDIR /app/server

RUN addgroup -S varta && adduser -S varta -G varta

COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/server/certs ./certs

RUN chown -R varta:varta /app

USER varta
EXPOSE 5000 5001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
