#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning up dangling Docker containers, networks, and images..."
docker compose -f ops/compose/compose.yaml down --remove-orphans
docker system prune -f --volumes

echo "Cleanup completed."
