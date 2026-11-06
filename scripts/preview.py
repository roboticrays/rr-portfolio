"""Local-only preview with byte ranges, so the films can seek immediately."""
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.byte_range = None
        path = Path(self.translate_path(self.path))
        value = self.headers.get('Range')
        if not value or not path.is_file():
            return super().send_head()
        size = path.stat().st_size
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', value)
        if not match:
            self.send_error(416)
            return None
        start, end = match.groups()
        start, end = (int(start), int(end) if end else size - 1) if start else (max(0, size - int(end or size)), size - 1)
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None
        stream = path.open('rb')
        stream.seek(start)
        self.byte_range = (start, end)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        return stream

    def copyfile(self, source, output):
        try:
            if not self.byte_range:
                return super().copyfile(source, output)
            remaining = self.byte_range[1] - self.byte_range[0] + 1
            while remaining:
                data = source.read(min(65536, remaining))
                if not data:
                    break
                output.write(data)
                remaining -= len(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 4173), partial(Handler, directory=str(ROOT)))
    print('Robotic Rays local preview: http://127.0.0.1:4173', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
