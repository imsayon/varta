#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"
if [[ -e ops/env/local.env ]]; then
  echo 'ops/env/local.env already exists; leaving it unchanged.'
  exit 0
fi
command -v openssl >/dev/null
umask 077
cp ops/env/local.env.example ops/env/local.env
for key in POSTGRES_PASSWORD REDIS_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET JWT_WS_SECRET ENCRYPTION_KEY METRICS_AUTH_TOKEN; do
  value="$(openssl rand -hex 32)"
  sed -i "s/^${key}=.*/${key}=${value}/" ops/env/local.env
done
# Optional local metrics scraper reads this token without committing it.
sed -n 's/^METRICS_AUTH_TOKEN=//p' ops/env/local.env > ops/env/local.metrics.token
echo 'Local configuration created. Start with: bash ops/scripts/compose.sh up -d --build'
