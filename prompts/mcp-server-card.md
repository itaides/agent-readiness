# Publish an MCP Server Card

Serve `/.well-known/mcp/server-card.json` as JSON with a transport declaration and non-empty `serverInfo.name`. Describe only reachable transports and keep credentials out of the card. Verify with `agent-readiness <url> --only mcp-server-card`.
