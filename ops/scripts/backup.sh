#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-ops/env/local.env}"

if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

DB_NAME="${POSTGRES_DB:-varta}"
DB_USER="${POSTGRES_USER:-varta}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="ops/backups"
BACKUP_FILE="${BACKUP_DIR}/varta_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Creating database backup for $DB_NAME..."
if [ -n "${DATABASE_URL:-}" ]; then
    pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl > "$BACKUP_FILE"
else
    docker compose -f ops/compose/compose.yaml exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner --no-acl > "$BACKUP_FILE"
fi
sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"

echo "Backup created successfully at $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))."
