# Publish OAuth authorization server metadata

Serve RFC 8414 metadata at `/.well-known/oauth-authorization-server`, including the exact issuer and real authorization/token endpoints. Do not invent endpoints. Verify with `agent-readiness <url> --only oauth-authorization-server`.
