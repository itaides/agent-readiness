# Fix sitemap discovery

Publish a valid XML sitemap at `/sitemap.xml`, or advertise its absolute URL with a `Sitemap:` directive in `robots.txt`. Return HTTP 200 with an XML content type. Verify with `agent-readiness <url> --only sitemap`.
