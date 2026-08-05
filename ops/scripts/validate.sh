#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-ops/env/production.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: Environment file $ENV_FILE does not exist." >&2
    exit 1
fi

# Load variables from env file
export $(grep -v '^#' "$ENV_FILE" | xargs)

REQUIRED_VARS=(
    "JWT_ACCESS_SECRET"
    "JWT_REFRESH_SECRET"
    "JWT_WS_SECRET"
    "METRICS_AUTH_TOKEN"
    "ENCRYPTION_KEY"
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
)

ERRORS=0

for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    if [ -z "$val" ]; then
        echo "ERROR: Required environment variable $var is missing or empty." >&2
        ERRORS=$((ERRORS + 1))
    elif [ "${#val}" -lt 32 ]; then
        echo "ERROR: $var must be at least 32 characters long (currently ${#val} chars)." >&2
        ERRORS=$((ERRORS + 1))
    elif [[ "$val" == *"CHANGE_ME"* ]] || [[ "$val" == *"local-"* ]]; then
        if [ "${NODE_ENV:-production}" = "production" ]; then
            echo "ERROR: $var contains insecure placeholder/default value in production." >&2
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [ "$ERRORS" -gt 0 ]; then
    echo "Preflight validation failed with $ERRORS error(s)." >&2
    exit 1
fi

echo "Preflight validation succeeded for $ENV_FILE."
