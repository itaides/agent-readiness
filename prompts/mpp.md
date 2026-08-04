# Add an MPP challenge

Return HTTP 402 from the paid resource with a syntactically valid `WWW-Authenticate: Payment` challenge that reflects the payment methods the server really accepts. Verify with `agent-readiness <url> --commerce-url <paid-resource>`.
