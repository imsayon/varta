#!/usr/bin/env bash
set -euo pipefail

blueprint="${1:-ops/deploy/render.yaml}"
if [[ ! -f "$blueprint" ]]; then
	printf 'ERROR: Render Blueprint %s does not exist.\n' "$blueprint" >&2
	exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
yaml_bin="$repo_root/server/node_modules/.bin/yaml"
if [[ ! -x "$yaml_bin" ]]; then
	printf '%s\n' 'ERROR: YAML validator is unavailable; install workspace dependencies first.' >&2
	exit 1
fi

yaml_json="$("$yaml_bin" -j < "$blueprint")"
python3 - "$repo_root" "$yaml_json" <<'PY'
import json
import os
import sys

repo_root, stream = sys.argv[1:]
documents = json.loads(stream)
document = documents[0] if isinstance(documents, list) and len(documents) == 1 else None
if not isinstance(document, dict) or not isinstance(document.get("services"), list):
    raise SystemExit("Blueprint must contain a services array")

services = document["services"]
if len(services) != 2:
    raise SystemExit("Blueprint must define exactly two services")

by_name = {service.get("name"): service for service in services}
for name in ("varta-api", "varta-client"):
    service = by_name.get(name)
    if not service:
        raise SystemExit(f"Missing service {name}")
    if service.get("type") != "web" or service.get("runtime") != "node" or service.get("plan") != "free":
        raise SystemExit(f"{name} must be a free Node web service")
    for key in ("buildCommand", "startCommand", "healthCheckPath", "envVars"):
        if key not in service:
            raise SystemExit(f"{name} is missing {key}")

api = by_name["varta-api"]
if "start:combined" not in api["startCommand"]:
    raise SystemExit("API must start the combined backend")
if api["healthCheckPath"] != "/api/health/ready":
    raise SystemExit("API health check must be API readiness")

client = by_name["varta-client"]
if "@varta/web" not in client["startCommand"] or "start" not in client["startCommand"]:
    raise SystemExit("Client must use the Next.js production start command")

api_env = {entry.get("key"): entry for entry in api["envVars"]}
client_env = {entry.get("key"): entry for entry in client["envVars"]}
for key in ("DATABASE_URL", "REDIS_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_WS_SECRET", "ENCRYPTION_KEY", "METRICS_AUTH_TOKEN", "CORS_ORIGIN", "CLIENT_URL"):
    if api_env.get(key, {}).get("sync") is not False:
        raise SystemExit(f"API secret/config {key} must be explicitly supplied")
if client_env.get("NEXT_PUBLIC_API_URL", {}).get("sync") is not False:
    raise SystemExit("Client API origin must be explicitly supplied")

with open(os.path.join(repo_root, ".node-version"), encoding="utf-8") as version_file:
    if version_file.read().strip() != "24.18.0":
        raise SystemExit("Node version must remain 24.18.0")

print("Render Blueprint validation passed: " + ", ".join(service["name"] for service in services))
PY
