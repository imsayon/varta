#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="$repo_root/ops/compose/compose.yaml"
env_file="$repo_root/ops/env/local.env"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Copy ops/env/local.env.example first." >&2
  exit 1
fi

exec docker compose --env-file "$env_file" -f "$compose_file" "$@"
