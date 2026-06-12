#!/usr/bin/env python3
"""
Super Mario Adventure - Stable Game Server
Fixed version (no crashes, production-safe logging, API support)
"""

import json
import os
import time
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

# ── CONFIG ────────────────────────────────────────────────
PORT = int(os.environ.get("PORT", 8000))
HOST = os.environ.get("HOST", "0.0.0.0")
GAME_DIR = os.path.dirname(os.path.abspath(__file__))

high_scores = []
_lock = threading.Lock()


# ── API HANDLER ───────────────────────────────────────────
def handle_api(path: str, method: str, body: bytes):
    if path == "/api/scores" and method == "GET":
        with _lock:
            return 200, {
                "scores": sorted(high_scores, key=lambda s: -s["score"])[:10]
            }

    if path == "/api/scores" and method == "POST":
        try:
            data = json.loads(body)
            name = str(data.get("name", "PLAYER"))[:12].upper()
            score = int(data.get("score", 0))
            world = str(data.get("world", "1-1"))
        except:
            return 400, {"error": "Invalid JSON"}

        entry = {
            "name": name,
            "score": score,
            "world": world,
            "ts": int(time.time())
        }

        with _lock:
            high_scores.append(entry)
            high_scores.sort(key=lambda s: -s["score"])
            del high_scores[100:]

        return 201, entry

    if path == "/api/scores" and method == "DELETE":
        with _lock:
            high_scores.clear()
        return 200, {"cleared": True}

    if path == "/api/health":
        return 200, {"status": "ok", "scores": len(high_scores)}

    return 404, {"error": "Not found"}


# ── HTTP SERVER ───────────────────────────────────────────
class MarioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=GAME_DIR, **kwargs)

    # ---- CORS ----
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ---- SEND JSON ----
    def _send_json(self, status, data):
        body = json.dumps(data).encode()

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    # ---- GET ----
    def do_GET(self):
        parsed = urlparse(self.path)

        # API
        if parsed.path.startswith("/api/"):
            status, data = handle_api(parsed.path, "GET", b"")
            return self._send_json(status, data)

        # ignore favicon (IMPORTANT FIX)
        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        # SPA routing
        if "." not in os.path.basename(parsed.path) and parsed.path != "/":
            self.path = "/index.html"

        super().do_GET()

    # ---- POST ----
    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""

        status, data = handle_api(parsed.path, "POST", body)
        self._send_json(status, data)

    # ---- DELETE ----
    def do_DELETE(self):
        parsed = urlparse(self.path)
        status, data = handle_api(parsed.path, "DELETE", b"")
        self._send_json(status, data)

    # ---- FIXED LOGGING (NO CRASH) ----
    def log_message(self, fmt, *args):
        try:
            msg = fmt % args

            # hide API spam (optional)
            if "/api/" in msg:
                return

            print("[GAME SERVER]", msg)

        except Exception:
            pass


# ── RUN SERVER ────────────────────────────────────────────
def run():
    server = HTTPServer((HOST, PORT), MarioHandler)

    print("=" * 55)
    print(" 🍄 Super Mario Adventure Server (FIXED)")
    print("=" * 55)
    print(f" Game → http://localhost:{PORT}")
    print(f" API  → http://localhost:{PORT}/api/scores")
    print(f" Host → {HOST}:{PORT}")
    print(" Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n Server stopped.")
        server.server_close()


if __name__ == "__main__":
    run()