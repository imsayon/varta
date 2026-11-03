FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build

RUN npm install --global pnpm@11.20.0

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY client/package.json ./client/package.json
RUN pnpm install --frozen-lockfile --filter @varta/web...

COPY client/ ./client/
WORKDIR /app/client
ARG API_URL=http://api:5000
ENV API_URL=$API_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm build

FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runtime

LABEL org.opencontainers.image.authors="Sayon sayn731@gmail.com"
LABEL org.opencontainers.image.source="https://github.com/imsayon/varta"

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build /app/client/.next/standalone ./

RUN apk upgrade --no-cache \
  && addgroup -S varta \
  && adduser -S varta -G varta \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && chown -R varta:varta /app

USER varta
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "client/server.js"]
