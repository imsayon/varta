#!/usr/bin/env bash
set -euo pipefail

tracked_env_files="$(git ls-files | awk '$0 !~ /(^|\/)\.env\.example$/ && $0 ~ /(^|\/)\.env($|\.)|(^|\/)production\.env$/' || true)"
if [[ -n "$tracked_env_files" ]]; then
	printf '%s\n' 'ERROR: real or production environment files are tracked:' >&2
	printf '%s\n' "$tracked_env_files" >&2
	exit 1
fi

if [[ "$(cat .node-version)" != "24.18.0" ]]; then
	printf '%s\n' 'ERROR: .node-version must remain pinned to 24.18.0.' >&2
	exit 1
fi

if ! grep -q 'node:24\.18\.0' ops/docker/server.Dockerfile ops/docker/client.Dockerfile; then
	printf '%s\n' 'ERROR: production Dockerfiles must use Node 24.18.0.' >&2
	exit 1
fi

git diff --check
printf '%s\n' 'Repository policy validation passed.'
