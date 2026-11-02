"""Progress plumbing.

TRELLIS reports its sampling progress through ``tqdm`` on stderr, and prints
diagnostics on stdout.  A service needs both a coarse, stage-level progress
value *and* the log lines, so this module tees both streams, keeps a bounded
tail of the log, and parses the tqdm bars into a fraction.
"""

from __future__ import annotations

import io
import re
import sys
import threading
from collections import deque
from contextlib import contextmanager
from typing import Callable, Deque, Optional

# " 42%|####      | 5/12 [00:03<00:05,  1.8it/s]"
_TQDM_PERCENT = re.compile(r"(\d{1,3})%\|")
_TQDM_FRACTION = re.compile(r"(\d+)/(\d+)\s*\[")
_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")

ProgressCallback = Callable[[float, str], None]


class Progress:
    """Maps the pipeline's own progress onto a global 0..1 value.

    Sub-stages are declared as ``(start, end)`` spans, so a sampler that runs
    from 8 % to 45 % of the whole job can report its own tqdm percentage.
    """

    def __init__(self, callback: Optional[ProgressCallback] = None, log_lines: int = 400):
        self._callback = callback
        self._lock = threading.Lock()
        self.value = 0.0
        self.stage = "queued"
        self.log: Deque[str] = deque(maxlen=log_lines)
        self._span: tuple[float, float] = (0.0, 0.0)

    # -- stages ------------------------------------------------------------
    def begin(self, stage: str, start: float, end: float, message: str | None = None) -> None:
        with self._lock:
            self.stage = stage
            self._span = (start, end)
            self.value = max(self.value, start)
        if message:
            self.append(message)
        self._emit()

    def fraction(self, inner: float) -> None:
        """Report progress *within* the current stage (0..1)."""
        start, end = self._span
        with self._lock:
            self.value = max(self.value, start + (end - start) * max(0.0, min(1.0, inner)))
        self._emit()

    def finish(self) -> None:
        with self._lock:
            self.stage = "completed"
            self.value = 1.0
        self._emit()

    def _emit(self) -> None:
        if self._callback:
            try:
                self._callback(self.value, self.stage)
            except Exception:  # a broken client must not kill a generation
                pass

    # -- log ---------------------------------------------------------------
    def append(self, line: str) -> None:
        line = _ANSI.sub("", line).rstrip()
        if line:
            self.log.append(line)

    @contextmanager
    def capture_output(self):
        """Tee stdout/stderr into the log and turn tqdm bars into progress."""
        out, err = sys.stdout, sys.stderr
        tee_out = _Tee(out, self)
        tee_err = _Tee(err, self)
        sys.stdout, sys.stderr = tee_out, tee_err
        try:
            yield self
        finally:
            tee_out.flush()
            tee_err.flush()
            sys.stdout, sys.stderr = out, err


class _Tee(io.TextIOBase):
    """Minimal stream that mirrors writes and mines them for progress."""

    def __init__(self, target, progress: Progress):
        self._target = target
        self._progress = progress
        self._buf = ""

    def write(self, text: str) -> int:  # type: ignore[override]
        try:
            self._target.write(text)
        except Exception:
            pass
        self._consume(text)
        return len(text)

    def flush(self) -> None:  # type: ignore[override]
        try:
            self._target.flush()
        except Exception:
            pass

    def isatty(self) -> bool:  # keep tqdm's formatting sane
        return False

    # -- parsing -----------------------------------------------------------
    def _consume(self, text: str) -> None:
        self._buf += text
        *lines, self._buf = re.split(r"[\r\n]", self._buf)
        for line in lines:
            self._parse(line)
        # tqdm redraws a bar with a bare "\r", so the newest bar is often still
        # unterminated: parse it too, without dropping it from the buffer.
        if _TQDM_PERCENT.search(self._buf) or _TQDM_FRACTION.search(self._buf):
            self._parse(self._buf)

    def _parse(self, line: str) -> None:
        clean = _ANSI.sub("", line)
        if not clean.strip():
            return
        match = _TQDM_PERCENT.search(clean)
        if match:
            self._progress.fraction(int(match.group(1)) / 100.0)
            label = clean.split("|")[-1].strip()
            if label:
                self._progress.append(f"{clean.split('|')[0].strip()} {label}")
            return
        match = _TQDM_FRACTION.search(clean)
        if match:
            done, total = int(match.group(1)), int(match.group(2))
            if total:
                self._progress.fraction(done / total)
        self._progress.append(clean)
