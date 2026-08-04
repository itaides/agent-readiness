# Remediation prompts

Each file is a copy-ready implementation prompt for one check. The CLI reports a concise fix and verification command inline, while structured JSON identifies the corresponding file through `checks[].remediation.promptPath`. Supply the failing check's `message` and `evidence` to the coding agent, preserve the site's existing framework and security posture, and rerun the exact check after the change.
