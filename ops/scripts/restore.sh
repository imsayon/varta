#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
ENV_FILE="${2:-ops/env/local.env}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file is required and must exist." >&2
    echo "Usage: RESTORE_DATABASE_URL=... ./ops/scripts/restore.sh <path-to-backup.dump> [env-file]" >&2
    exit 1
fi

if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to an isolated restore database}"
if [ "${DATABASE_URL:-}" = "$RESTORE_DATABASE_URL" ]; then
    echo "ERROR: restore target must be isolated from the source database." >&2
    exit 1
fi

sha256sum --check "${BACKUP_FILE}.sha256"

echo "Restoring backup into the explicitly configured target..."
pg_restore --dbname="$RESTORE_DATABASE_URL" --exit-on-error --clean --if-exists --no-owner --no-acl "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS workspaces FROM varta.workspaces;' -c 'SELECT COUNT(*) AS notifications FROM varta.notifications;'

echo "Database restore completed successfully."
