# Publish Web Bot Auth keys

Implement `/.well-known/http-message-signatures-directory` as real JSON, not an SPA fallback. Publish the intended public verification keys with stable key identifiers and keep private keys out of the response. Verify with `agent-readiness <url> --only web-bot-auth`.
