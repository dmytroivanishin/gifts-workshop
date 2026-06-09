#!/usr/bin/env bash
set -e

# Resolve paths relative to the script location
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(dirname "$DIR")"
ENV_FILE="$ROOT_DIR/config/local.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "⚠️  $ENV_FILE not found. Running without injected environment variables."
fi

# Execute the npm script passed as arguments
echo "🚀 Running: npm run $@"
cd "$ROOT_DIR" && npm run "$@"
