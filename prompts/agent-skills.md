# Publish Agent Skills discovery v0.2

Serve `/.well-known/agent-skills/index.json` using the v0.2 schema URI. Give every skill a valid name, type, description, artifact URL, and lowercase SHA-256 digest. Verify metadata and artifacts with `agent-readiness <url> --only agent-skills --verify-skill-digests`.
