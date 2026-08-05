#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
ENV_FILE="${2:-ops/env/local.env}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is required and must exist." >&2
    echo "Usage: ./ops/scripts/restore.sh <path-to-backup.sql.gz> [env-file]" >&2
    exit 1
fi

if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

DB_NAME="${POSTGRES_DB:-varta}"
DB_USER="${POSTGRES_USER:-varta}"

echo "Restoring database $DB_NAME from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker compose -f ops/compose/compose.yaml exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"

echo "Database restore completed successfully."
