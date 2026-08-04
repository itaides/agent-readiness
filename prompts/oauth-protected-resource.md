# Publish OAuth protected resource metadata

Serve RFC 9728 metadata at `/.well-known/oauth-protected-resource` with the canonical resource identifier and its supported authorization servers/scopes. Verify with `agent-readiness <url> --only oauth-protected-resource`.
