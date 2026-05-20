#!/bin/sh
set -e

# agent-readiness one-line installer
# Usage:  curl -fsSL https://raw.githubusercontent.com/itaides/agent-readiness/main/install.sh | sh

if ! command -v bun >/dev/null 2>&1; then
  echo "agent-readiness requires bun (https://bun.sh)." >&2
  echo "" >&2
  echo "Install bun first:" >&2
  echo "  curl -fsSL https://bun.sh/install | bash" >&2
  echo "" >&2
  echo "Then re-run this installer." >&2
  exit 1
fi

bun install -g github:itaides/agent-readiness

echo ""
echo "agent-readiness installed."
echo "Try:  agent-readiness https://example.com"
echo "Docs: https://github.com/itaides/agent-readiness"
