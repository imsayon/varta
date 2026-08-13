#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

if [[ -z "${DIRECT_URL:-}" ]]; then
	printf '%s\n' 'ERROR: DIRECT_URL is required for Prisma drift validation.' >&2
	exit 1
fi

diff_sql="$(corepack pnpm@11.20.0 --dir server exec prisma migrate diff \
	--from-config-datasource \
	--to-schema prisma/schema.prisma \
	--script)"

# Prisma cannot represent pgvector HNSW indexes on Unsupported fields. Preserve
# this migration-owned index while rejecting every other schema difference.
expected_diff=$'-- DropIndex\nDROP INDEX "subscriber_engagement_vectors_embedding_hnsw_idx";'
no_diff='-- This is an empty migration.'
normalized_diff="${diff_sql%$'\n'}"
if [[ "$normalized_diff" != "$no_diff" && "$normalized_diff" != "$expected_diff" ]]; then
	printf '%s\n' 'ERROR: unexpected Prisma schema drift:' >&2
	printf '%s\n' "$diff_sql" >&2
	exit 1
fi

if [[ "$normalized_diff" == "$no_diff" ]]; then
	printf '%s\n' 'Prisma drift validation passed; database and Prisma schema match.'
else
	printf '%s\n' 'Prisma drift validation passed; only the migration-owned pgvector HNSW index is outside Prisma schema representation.'
fi
