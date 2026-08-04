# Fix robots.txt

Create or correct `/robots.txt` so it returns HTTP 200 as `text/plain`, contains at least one valid `User-agent:` group, and reflects the site's intended crawl policy. Do not weaken existing restrictions. Verify with `agent-readiness <url> --only robots-txt`.
