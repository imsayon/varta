#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-ops/env/local.env}"

if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

DB_NAME="${POSTGRES_DB:-varta}"
DB_USER="${POSTGRES_USER:-varta}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="ops/backups"
BACKUP_FILE="${BACKUP_DIR}/varta_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Creating database backup for $DB_NAME..."
docker compose -f ops/compose/compose.yaml exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "Backup created successfully at $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))."
