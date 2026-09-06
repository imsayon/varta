# BUILD
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build

RUN npm install --global pnpm@11.20.0

WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --filter @varta/server...

COPY server/ ./server/
WORKDIR /app/server
RUN DIRECT_URL='postgresql://generate:generate@localhost:5432/generate?schema=varta' pnpm prisma:generate \
  && pnpm build \
  && PNPM_CONFIG_AUTO_INSTALL_PEERS=false PNPM_CONFIG_STRICT_PEER_DEPENDENCIES=false \
    pnpm --filter @varta/server deploy --prod --legacy /prod/server \
  && cd /prod/server \
  && node -e "const fs=require('node:fs'); const file='package.json'; const manifest=JSON.parse(fs.readFileSync(file,'utf8')); delete manifest.devDependencies; fs.writeFileSync(file, JSON.stringify(manifest, null, 2)+'\\n')" \
  && PNPM_CONFIG_AUTO_INSTALL_PEERS=false PNPM_CONFIG_STRICT_PEER_DEPENDENCIES=false \
    PNPM_CONFIG_STRICT_DEP_BUILDS=false \
    pnpm prune --prod --ignore-scripts \
  && rm -rf node_modules \
  && PNPM_CONFIG_AUTO_INSTALL_PEERS=false PNPM_CONFIG_STRICT_PEER_DEPENDENCIES=false \
    PNPM_CONFIG_STRICT_DEP_BUILDS=false \
    pnpm install --prod --frozen-lockfile --ignore-scripts \
  && DIRECT_URL='postgresql://generate:generate@localhost:5432/generate?schema=varta' \
    /app/server/node_modules/.bin/prisma generate

# RUN
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime

LABEL org.opencontainers.image.authors="Sayon sayn731@gmail.com"
LABEL org.opencontainers.image.source="https://github.com/imsayon/varta"

ENV NODE_ENV=production
WORKDIR /app/server

RUN addgroup -S varta \
  && adduser -S varta -G varta \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build /prod/server/ ./

RUN chown -R varta:varta /app

USER varta
EXPOSE 5000 5001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
