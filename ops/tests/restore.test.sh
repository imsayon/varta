#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
touch "$test_dir/backup.dump"
# Invalid targets must fail before any database or Docker command is run.
for command in pg_restore psql docker; do
    printf '#!/bin/sh\ntouch "%s/database-command-called"\nexit 99\n' "$test_dir" > "$test_dir/$command"
    chmod +x "$test_dir/$command"
done
export PATH="$test_dir:$PATH"
if env -u RESTORE_DATABASE_URL bash "$repo_root/ops/scripts/restore.sh" "$test_dir/backup.dump" /dev/null > "$test_dir/result" 2>&1; then
    exit 1
fi
grep -q 'Set RESTORE_DATABASE_URL' "$test_dir/result"
if DATABASE_URL=postgresql://source RESTORE_DATABASE_URL=postgresql://source bash "$repo_root/ops/scripts/restore.sh" "$test_dir/backup.dump" /dev/null > "$test_dir/result" 2>&1; then
    exit 1
fi
grep -q 'restore target must be isolated' "$test_dir/result"
test ! -e "$test_dir/database-command-called"
echo 'Restore target guards passed.'
