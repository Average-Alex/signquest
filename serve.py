"""Local dev server for SignQuest.

Like `python -m http.server`, but tells the browser not to cache files, so a
normal refresh always picks up your latest changes. (Without this, a browser
can mix old and new game files, and then nothing works.)

    python serve.py          -> http://localhost:8000
    python serve.py 8080     -> http://localhost:8080
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=str(Path(__file__).parent))
    print(f"SignQuest running at http://localhost:{port}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("", port), handler).serve_forever()
