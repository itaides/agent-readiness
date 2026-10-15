# Expose a discoverable OpenAPI spec

Serve your OpenAPI 3.x (or Swagger) document at a standard path such as `/openapi.json` or `/swagger.json`, or reference it from `/.well-known/api-catalog`. Agents use the typed schema to call your API correctly. Verify with `agent-readiness <url> --only openapi-discovery`.
