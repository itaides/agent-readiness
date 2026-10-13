# Stop blocking AI-agent user agents

The content URL returns 401/403/429 to GPTBot or ClaudeBot while a browser user agent gets 200. Review WAF, CDN, and rate-limit rules and allowlist the agents you want to serve. Verify with `agent-readiness <url> --only bot-ua-differential`.
