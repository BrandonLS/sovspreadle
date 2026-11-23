"""Put your site's address into the page metadata (share previews need full addresses).
Usage: python3 scripts/set_domain.py https://sovspreadle.com
"""
import os, re, sys

if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
    sys.exit("Usage: python3 scripts/set_domain.py https://your-domain")
url = sys.argv[1].rstrip("/") + "/"
path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "index.html")
html = open(path).read()
html = re.sub(r'(<link rel="canonical" href=")[^"]*(")', rf"\g<1>{url}\2", html)
html = re.sub(r'(<meta property="og:url" content=")[^"]*(")', rf"\g<1>{url}\2", html)
html = re.sub(r'(<meta property="og:image" content=")[^"]*(")', rf"\g<1>{url}og.png\2", html)
open(path, "w").write(html)
print(f"index.html now points to {url}")
