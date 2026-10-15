#!/bin/sh
set -e

# agent-readiness one-line installer
# Usage:  curl -fsSL https://raw.githubusercontent.com/itaides/agent-readiness/main/install.sh | sh

if command -v npm >/dev/null 2>&1; then
  npm install -g @itaides/agent-readiness
elif command -v bun >/dev/null 2>&1; then
  bun add -g @itaides/agent-readiness
else
  echo "agent-readiness needs Node.js 20+ (https://nodejs.org) or Bun (https://bun.sh)." >&2
  exit 1
fi

echo ""
echo "agent-readiness installed."
echo "Try:  agent-readiness https://example.com"
echo "Docs: https://github.com/itaides/agent-readiness"
