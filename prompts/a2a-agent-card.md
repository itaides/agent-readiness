# Publish an A2A Agent Card

Serve a current A2A `AgentCard` at `/.well-known/agent-card.json` with identity, version, supported interfaces, capabilities, input/output modes, and validated skills. Do not expose credentials or internal-only endpoints. Verify with `agent-readiness <url> --only a2a-agent-card`.
