# Publish UCP discovery

Serve the merchant profile at `/.well-known/ucp` with a date-formatted version plus `services` and `payment_handlers` registries that match the implemented commerce surface. Verify with `agent-readiness <url> --commerce-url <paid-resource>`.
