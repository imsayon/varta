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

yaml_json="$($yaml_bin -j < "$blueprint")"
python3 - "$repo_root" "$yaml_json" <<'PY'
import json
import os
import sys

repo_root, stream = sys.argv[1:]
documents = json.loads(stream)
document = documents[0] if isinstance(documents, list) and len(documents) == 1 else None
if not isinstance(document, dict) or set(document) != {"projects"}:
    raise SystemExit("Blueprint must contain only a projects array")

projects = document["projects"]
if len(projects) != 1:
    raise SystemExit("Blueprint must define exactly one project")
project = projects[0]
if project.get("name") != "Varta Public Beta":
    raise SystemExit("Project must be named Varta Public Beta")

environments = project.get("environments")
if not isinstance(environments, list) or len(environments) != 1:
    raise SystemExit("Project must define exactly one environment")
environment = environments[0]
if environment.get("name") != "Varta Public Beta":
    raise SystemExit("Environment must be named Varta Public Beta")
if environment.get("permissions", {}).get("protection") != "enabled":
    raise SystemExit("Varta Public Beta environment must be protected")

services = environment.get("services")
if not isinstance(services, list) or len(services) != 3:
    raise SystemExit("Environment must define exactly three services")
by_name = {service.get("name"): service for service in services}
if set(by_name) != {"varta-valkey", "varta-api", "varta-client"}:
    raise SystemExit("Environment must contain varta-valkey, varta-api, and varta-client")

valkey = by_name["varta-valkey"]
if {
    valkey.get("type"), valkey.get("plan"), valkey.get("region"),
    valkey.get("maxmemoryPolicy"), valkey.get("persistenceMode"),
} != {"keyvalue", "free", "singapore", "noeviction", "off"}:
    raise SystemExit("varta-valkey must be Singapore/free/noeviction/off")
if valkey.get("ipAllowList") != []:
    raise SystemExit("varta-valkey ipAllowList must be empty")

for name in ("varta-api", "varta-client"):
    service = by_name[name]
    if (
        service.get("type") != "web"
        or service.get("runtime") != "node"
        or service.get("plan") != "free"
        or service.get("region") != "singapore"
        or service.get("repo") != "https://github.com/imsayon/varta"
        or service.get("branch") != "main"
        or service.get("autoDeploy") is not False
    ):
        raise SystemExit(f"{name} must be Singapore/free/node, explicit main repo, autoDeploy false")
    for key in ("buildCommand", "startCommand", "healthCheckPath", "envVars"):
        if key not in service:
            raise SystemExit(f"{name} is missing {key}")
    env_vars = service["envVars"]
    if not isinstance(env_vars, list):
        raise SystemExit(f"{name}.envVars must be a list")

api = by_name["varta-api"]
if "start:combined" not in api["startCommand"]:
    raise SystemExit("API must start the combined backend")
if api["healthCheckPath"] != "/api/health/combined/ready":
    raise SystemExit("API health check must include API and worker readiness")

client = by_name["varta-client"]
if "@varta/web" not in client["startCommand"] or "start" not in client["startCommand"]:
    raise SystemExit("Client must use the Next.js production start command")

api_env = {entry.get("key"): entry for entry in api["envVars"]}
client_env = {entry.get("key"): entry for entry in client["envVars"]}
if api_env.get("REDIS_URL", {}).get("fromService") != {
    "type": "keyvalue", "name": "varta-valkey", "property": "connectionString",
}:
    raise SystemExit("API REDIS_URL must reference varta-valkey.connectionString")
if api_env.get("REDIS_QUEUE_PREFIX", {}).get("value") != "varta_public_beta":
    raise SystemExit("REDIS_QUEUE_PREFIX must use the public-beta namespace")

secret_keys = (
    "DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_WS_SECRET",
    "CORS_ORIGIN", "CLIENT_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET",
    "GITHUB_CALLBACK_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL", "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "EMAIL_FROM",
    "AI_PLATFORM_API_KEY", "ENCRYPTION_KEY", "METRICS_AUTH_TOKEN",
    "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_WEBHOOK_SECRET_PREVIOUS", "RAZORPAY_PLUS_PLAN_ID_INR",
    "RAZORPAY_BUSINESS_PLAN_ID_INR",
)
for key in secret_keys:
    if api_env.get(key, {}).get("sync") is not False:
        raise SystemExit(f"API secret/provider key {key} must use sync: false")
if client_env.get("NEXT_PUBLIC_API_URL", {}).get("sync") is not False:
    raise SystemExit("Client API URL must use sync: false")
if api_env.get("RAZORPAY_MODE", {}).get("value") != "test":
    raise SystemExit("Razorpay must be explicitly configured for test mode")
for key in ("AI_ENABLED", "AI_LOG_PROMPT_CONTENT", "AI_SEND_TIME_OPTIMIZATION_ENABLED", "AI_USAGE_TRACKING_ENABLED"):
    if api_env.get(key, {}).get("value") != "false":
        raise SystemExit(f"{key} must initially be false")
if api_env.get("AI_PLATFORM_PROVIDER", {}).get("value") != "gemini":
    raise SystemExit("AI platform provider must be Gemini")
if api_env.get("AI_PLATFORM_MODEL", {}).get("value") != "gemini-3.6-flash":
    raise SystemExit("AI platform model must be the supported Gemini launch model")

for service in (api, client):
    if service["envVars"][0].get("key") != "NODE_VERSION" or service["envVars"][0].get("value") != "24.18.0":
        raise SystemExit(f"{service['name']} must pin Node 24.18.0")
with open(os.path.join(repo_root, ".node-version"), encoding="utf-8") as version_file:
    if version_file.read().strip() != "24.18.0":
        raise SystemExit(".node-version must remain 24.18.0")

print("Render Blueprint validation passed: Varta Public Beta / Varta Public Beta / varta-valkey, varta-api, varta-client")
PY
