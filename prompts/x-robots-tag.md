# Remove restrictive X-Robots-Tag values

The content response sends `X-Robots-Tag` values that block agents (noindex, nosnippet, noai, noimageai, none). Remove them where agents should read, or scope them to specific bots deliberately. Verify with `agent-readiness <url> --only x-robots-tag`.
