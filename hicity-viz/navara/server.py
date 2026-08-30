#!/usr/bin/env python3
"""Navara版ビューアのローカル配信サーバー(マルチスレッド・WASM/Worker対応ヘッダ付き)"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print(f'serving {ROOT} at http://localhost:{PORT}/', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
