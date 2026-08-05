FROM node:24.18.0-alpine AS build

RUN npm install --global pnpm@11.20.0

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY client/package.json ./client/package.json
RUN pnpm install --frozen-lockfile --filter @varta/web...

COPY client/ ./client/
WORKDIR /app/client
ARG NEXT_PUBLIC_API_URL=http://api:5000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

FROM node:24.18.0-alpine AS runtime

LABEL org.opencontainers.image.authors="Sayon sayn731@gmail.com"
LABEL org.opencontainers.image.source="https://github.com/imsayon/varta"

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/client/.next/standalone ./
COPY --from=build /app/client/.next/static ./client/.next/static
COPY --from=build /app/client/public ./client/public

RUN addgroup -S varta && adduser -S varta -G varta && chown -R varta:varta /app

USER varta
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "client/server.js"]
