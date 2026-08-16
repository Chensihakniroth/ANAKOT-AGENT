"""PTY bridge for ``anakot dashboard`` / ``anakot web`` chat tab.

Wraps a child process behind a pseudo-terminal so its ANSI output can be
streamed to a browser-side terminal emulator (xterm.js) and typed
keystrokes can be fed back in.  The only caller today is the
``/api/pty`` WebSocket endpoint in ``anakot_cli.web_server``.

Design constraints:

* **Cross-platform.**  On POSIX (Linux, macOS, WSL2) we use the standard
  ``ptyprocess`` wrapper around ``forkpty``.  On native Windows we use
  ``pywinpty``, which wraps the Windows ConPTY API (Windows 10 build
  17763+).  The rest of the dashboard works on every platform; the chat
  tab now does too.
* **Zero Node dependency on the server side.**  The browser talks to the
  same ``anakot --tui`` binary it would launch from the CLI, so every TUI
  feature (slash popover, model picker, tool rows, markdown, skin engine,
  clarify/sudo/approval prompts) ships automatically.
* **Byte-safe I/O.**  Reads and writes go through the PTY master fd /
  handle directly — we avoid text-mode wrappers because streaming ANSI is
  inherently byte-oriented and UTF-8 boundaries may land mid-read.
"""

from __future__ import annotations

import errno
import os
import sys
import time
from typing import Optional, Sequence

# -----------------------------------------------------------------------
# Platform detection
# -----------------------------------------------------------------------
_IS_WINDOWS = sys.platform.startswith("win")

# -----------------------------------------------------------------------
# POSIX imports (fcntl, termios, select, signal, struct, ptyprocess) —
# guarded so the module is importable on Windows where none of these exist.
# -----------------------------------------------------------------------
if _IS_WINDOWS:
    fcntl = None  # type: ignore[assignment]
    select = None  # type: ignore[assignment]
    signal = None  # type: ignore[assignment]
    struct = None  # type: ignore[assignment]
    termios = None  # type: ignore[assignment]
    ptyprocess = None  # type: ignore[assignment]
else:
    import fcntl
    import select
    import signal
    import struct
    import termios

    try:
        import ptyprocess  # type: ignore
    except ImportError:  # pragma: no cover - dev env without ptyprocess
        ptyprocess = None  # type: ignore

# -----------------------------------------------------------------------
# Windows import (pywinpty) — guarded so the module is importable on
# POSIX where pywinpty doesn't exist.
# -----------------------------------------------------------------------
if _IS_WINDOWS:
    try:
        from winpty import PTY as _WinPTY  # type: ignore[import-untyped]
    except ImportError:
        _WinPTY = None  # type: ignore[assignment]
else:
    _WinPTY = None  # type: ignore[assignment]


__all__ = ["PtyBridge", "PtyUnavailableError"]

# Dimension clamping constants
_MIN_DIMENSION = 1
_MAX_COLS = 2000
_MAX_ROWS = 1000


def _clamp_dimension(value: int, maximum: int) -> int:
    """Clamp a reported terminal dimension into ``[_MIN_DIMENSION, maximum]``."""
    try:
        n = int(value)
    except (TypeError, ValueError, OverflowError):
        return _MIN_DIMENSION
    if n < _MIN_DIMENSION:
        return _MIN_DIMENSION
    if n > maximum:
        return maximum
    return n


class PtyUnavailableError(RuntimeError):
    """Raised when a PTY cannot be created on this platform."""


# =======================================================================
# POSIX backend (ptyprocess)
# =======================================================================

class _PosixPtyBridge:
    """Thin wrapper around ``ptyprocess.PtyProcess`` for byte streaming."""

    def __init__(self, proc: "ptyprocess.PtyProcess") -> None:
        self._proc = proc
        self._fd: int = proc.fd
        self._closed = False

    @classmethod
    def is_available(cls) -> bool:
        return ptyprocess is not None

    @classmethod
    def spawn(
        cls,
        argv: Sequence[str],
        *,
        cwd: Optional[str] = None,
        env: Optional[dict] = None,
        cols: int = 80,
        rows: int = 24,
    ) -> "_PosixPtyBridge":
        if ptyprocess is None:
            raise PtyUnavailableError(
                "The `ptyprocess` package is missing. "
                "Install with: pip install ptyprocess "
                "(or pip install -e '.[pty]')."
            )
        spawn_env = (os.environ.copy() if env is None else env.copy())
        if not spawn_env.get("TERM"):
            spawn_env["TERM"] = "xterm-256color"
        proc = ptyprocess.PtyProcess.spawn(
            list(argv),
            cwd=cwd,
            env=spawn_env,
            dimensions=(rows, cols),
        )
        return cls(proc)

    @property
    def pid(self) -> int:
        return int(self._proc.pid)

    def is_alive(self) -> bool:
        if self._closed:
            return False
        try:
            return bool(self._proc.isalive())
        except Exception:
            return False

    def read(self, timeout: float = 0.2) -> Optional[bytes]:
        if self._closed:
            return None
        try:
            readable, _, _ = select.select([self._fd], [], [], timeout)
        except (OSError, ValueError):
            return None
        if not readable:
            return b""
        try:
            data = os.read(self._fd, 65536)
        except OSError as exc:
            if exc.errno in {errno.EIO, errno.EBADF}:
                return None
            raise
        if not data:
            return None
        return data

    def write(self, data: bytes) -> None:
        if self._closed or not data:
            return
        view = memoryview(data)
        while view:
            try:
                n = os.write(self._fd, view)
            except OSError as exc:
                if exc.errno in {errno.EIO, errno.EBADF, errno.EPIPE}:
                    return
                raise
            if n <= 0:
                return
            view = view[n:]

    def resize(self, cols: int, rows: int) -> None:
        if self._closed:
            return
        cols = _clamp_dimension(cols, _MAX_COLS)
        rows = _clamp_dimension(rows, _MAX_ROWS)
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        try:
            fcntl.ioctl(self._fd, termios.TIOCSWINSZ, winsize)
        except OSError:
            pass

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        for _sig_name in ("SIGHUP", "SIGTERM", "SIGKILL"):
            sig = getattr(signal, _sig_name, None)
            if sig is None:
                continue
            if not self._proc.isalive():
                break
            try:
                self._proc.kill(sig)
            except Exception:
                pass
            deadline = time.monotonic() + 0.5
            while self._proc.isalive() and time.monotonic() < deadline:
                time.sleep(0.02)
        try:
            self._proc.close(force=True)
        except Exception:
            pass


# =======================================================================
# Windows backend (pywinpty / ConPTY)
# =======================================================================

class _WinPtyBridge:
    """Thin wrapper around ``winpty.PTY`` for byte streaming on Windows.

    ``pywinpty`` wraps the Windows ConPTY API.  Key API differences from the
    POSIX backend:

    - ``PTY.spawn(appname, cmdline, cwd, env)`` — *appname* is the executable
      path (str), *cmdline* is the argument string (str).
    - ``env`` must be a byte string of null-separated ``name=value`` pairs,
      terminated by a double-null.
    - ``read(size)`` blocks until data is available and returns ``str``.
    - ``write(text)`` takes ``str``.
    """

    def __init__(self, pty: "_WinPTY") -> None:
        self._pty = pty
        self._closed = False

    @classmethod
    def is_available(cls) -> bool:
        return _WinPTY is not None

    @classmethod
    def spawn(
        cls,
        argv: Sequence[str],
        *,
        cwd: Optional[str] = None,
        env: Optional[dict] = None,
        cols: int = 80,
        rows: int = 24,
    ) -> "_WinPtyBridge":
        if _WinPTY is None:
            raise PtyUnavailableError(
                "The `pywinpty` package is missing. "
                "Install with: pip install pywinpty"
            )
        pty = _WinPTY(cols, rows)

        # winpty.spawn(appname, cmdline=None, cwd=None, env=None)
        appname = argv[0]
        cmdline = None
        if len(argv) > 1:
            # On Windows, subprocess.list2cmdline produces proper quoting
            # for CreateProcess.  shlex.join uses Unix single-quotes which
            # cmd.exe does not understand.
            if _IS_WINDOWS:
                import subprocess  # noqa: PLC0415
                cmdline = subprocess.list2cmdline(argv[1:])
            else:
                import shlex  # noqa: PLC0415
                cmdline = shlex.join(argv[1:])

        # Build env string for pywinpty PTY.spawn (expects str, not bytes).
        # Format: null-separated "name=value" pairs, double-null terminated.
        win_env: Optional[str] = None
        if env is not None:
            merged = os.environ.copy()
            merged.update(env)
            win_env = "\0".join(f"{k}={v}" for k, v in merged.items()) + "\0"

        pty.spawn(appname, cmdline=cmdline, cwd=str(cwd) if cwd else None, env=win_env)
        return cls(pty)

    @property
    def pid(self) -> int:
        return int(self._pty.pid)

    def is_alive(self) -> bool:
        if self._closed:
            return False
        try:
            return bool(self._pty.isalive())
        except Exception:
            return False

    def read(self, timeout: float = 0.2) -> Optional[bytes]:
        if self._closed:
            return None
        try:
            import locale  # noqa: PLC0415
            data = self._pty.read(65536)
        except Exception:
            return None
        if not data:
            return b""
        if isinstance(data, str):
            enc = locale.getpreferredencoding() or "utf-8"
            return data.encode(enc, errors="surrogateescape")
        return data

    def write(self, data: bytes) -> None:
        if self._closed or not data:
            return
        try:
            import locale  # noqa: PLC0415
            enc = locale.getpreferredencoding() or "utf-8"
            text = data.decode(enc, errors="surrogateescape")
            self._pty.write(text)
        except Exception:
            pass

    def resize(self, cols: int, rows: int) -> None:
        if self._closed:
            return
        cols = _clamp_dimension(cols, _MAX_COLS)
        rows = _clamp_dimension(rows, _MAX_ROWS)
        try:
            self._pty.set_size(cols, rows)
        except Exception:
            pass

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        try:
            import ctypes  # noqa: PLC0415

            handle = ctypes.windll.kernel32.OpenProcess(1, False, self._pty.pid)  # type: ignore[attr-defined]
            if handle:
                ctypes.windll.kernel32.TerminateProcess(handle, 1)  # type: ignore[attr-defined]
                ctypes.windll.kernel32.CloseHandle(handle)  # type: ignore[attr-defined]
        except Exception:
            pass


# =======================================================================
# Public facade — picks the right backend at import time
# =======================================================================

if _IS_WINDOWS:
    PtyBridge = _WinPtyBridge
else:
    PtyBridge = _PosixPtyBridge
