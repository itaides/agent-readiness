# Advertise the API Catalog

Add an HTTP `Link` response header on the site root pointing to the catalog with `rel="api-catalog"`. Preserve existing Link values and verify with `agent-readiness <url> --only link-header-api-catalog`.
