"""Reliable cross-platform launcher for the GAMEPICK development server.

Uses the active Python interpreter (ideally the project's venv), starts FastAPI,
waits for /health, opens a browser, and records any startup errors.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG = ROOT / "gamepick-startup.log"


def get_port() -> int:
    """Prefer 5000; avoid a confusing 'port already in use' crash."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex(("127.0.0.1", 5000)) != 0:
            return 5000
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


def website_is_ready(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=0.8) as r:
            return r.status == 200 and b'"ok"' in r.read(256)
    except (OSError, urllib.error.URLError, ValueError):
        return False


def main() -> int:
    print("=" * 52)
    print("GAMEPICK STUDIO | Local launcher")
    print("=" * 52)
    if sys.version_info < (3, 10):
        print("ERROR: Python 3.10+ is required.")
        return 1
    if not (ROOT / "app.py").is_file() or not (ROOT / "static" / "index.html").is_file():
        print("ERROR: Incomplete project. Extract the ENTIRE ZIP to a folder first.")
        return 1

    port = get_port()
    url = f"http://127.0.0.1:{port}/"
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["PYTHONIOENCODING"] = "utf-8"
    print(f"Python: {sys.executable}")
    print(f"Website: {url}")
    print("Keep this window open while you use the site.")
    print(f"Error log: {LOG.name}\n")

    with LOG.open("w", encoding="utf-8") as log:
        log.write(f"Python: {sys.version}\nExecutable: {sys.executable}\nProject: {ROOT}\nURL: {url}\n\n")
        log.flush()
        try:
            proc = subprocess.Popen(
                [sys.executable, "-u", str(ROOT / "app.py")],
                cwd=str(ROOT), env=env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding="utf-8", errors="replace", bufsize=1,
            )
        except OSError as exc:
            print(f"ERROR: Cannot launch server: {exc}")
            log.write(f"Cannot launch server: {exc}\n")
            return 1

        def print_server_log() -> None:
            assert proc.stdout is not None
            for line in proc.stdout:
                print(line, end="", flush=True)
                log.write(line)
                log.flush()

        reader = threading.Thread(target=print_server_log, daemon=True)
        reader.start()
        started = False
        try:
            deadline = time.monotonic() + 35
            while time.monotonic() < deadline:
                if proc.poll() is not None:
                    break
                if website_is_ready(port):
                    started = True
                    break
                time.sleep(0.35)

            if not started:
                print("\nERROR: The server did not start successfully.")
                print("Look at the error above or open gamepick-startup.log")
                log.write("\nERROR: Server failed to reach /health.\n")
                proc.terminate() if proc.poll() is None else None
                return 1

            print(f"\nSITE IS RUNNING: {url}")
            print("If your browser does not open, copy this address manually.")
            try:
                if os.name == "nt":
                    os.startfile(url)  # type: ignore[attr-defined]
                else:
                    webbrowser.open(url)
            except OSError as exc:
                print(f"Browser did not open automatically: {exc}")
            print("To stop: close this window or press Ctrl+C.\n")
            exit_code = proc.wait()
            print(f"\nServer closed (exit code {exit_code}).")
            return 1 if exit_code else 0
        except KeyboardInterrupt:
            print("\nStopping GAMEPICK...")
            return 0
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
            reader.join(timeout=1)


if __name__ == "__main__":
    sys.exit(main())
