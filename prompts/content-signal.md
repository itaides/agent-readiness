# Add a Content Signals policy

Publish explicit `search`, `ai-input`, and `ai-train` preferences using `yes` or `no` in a `Content-Signal:` robots.txt directive or HTTP response header. Preserve the operator's policy intent; do not assume every value should be `yes`. Verify with `agent-readiness <url> --only content-signal`.
