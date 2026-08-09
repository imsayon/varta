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
    set -a
    source "$ENV_FILE"
    set +a
fi

DB_NAME="${POSTGRES_DB:-varta}"
DB_USER="${POSTGRES_USER:-varta}"

sha256sum --check "${BACKUP_FILE}.sha256"

echo "Restoring database $DB_NAME from $BACKUP_FILE..."
if [ -n "${RESTORE_DATABASE_URL:-}" ]; then
    if [ "${DATABASE_URL:-}" = "$RESTORE_DATABASE_URL" ]; then
        echo "ERROR: restore target must be isolated from the source database." >&2
        exit 1
    fi
    pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl "$BACKUP_FILE"
    psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS workspaces FROM workspaces;' -c 'SELECT COUNT(*) AS notifications FROM notifications;'
else
    docker compose -f ops/compose/compose.yaml exec -T postgres pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-acl < "$BACKUP_FILE"
fi

echo "Database restore completed successfully."
