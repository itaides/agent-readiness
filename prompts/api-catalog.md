# Publish an API Catalog

Serve an RFC 9727 linkset at `/.well-known/api-catalog` with a JSON-compatible content type and links to the API's service descriptions. Avoid SPA fallthrough. Verify with `agent-readiness <url> --only api-catalog`.
