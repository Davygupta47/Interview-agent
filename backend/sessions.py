from __future__ import annotations

import uuid
import time
import threading
from typing import Optional

_store: dict[str, dict] = {}
_lock = threading.Lock()

SESSION_TTL_SECONDS = 7200

def create(config: dict) -> str:
    sid = str(uuid.uuid4())[:8]
    with _lock:
        _store[sid] = {
            "config": config,
            "history": [],
            "complete": False,
            "created_at": time.time(),
            "last_active": time.time(),
        }
    return sid


def get(sid: str) -> Optional[dict]:
    with _lock:
        sess = _store.get(sid)
        if sess is None:
            return None
        # Check TTL
        if time.time() - sess["last_active"] > SESSION_TTL_SECONDS:
            del _store[sid]
            return None
        sess["last_active"] = time.time()
        return sess


def append(sid: str, entry: dict) -> None:
    with _lock:
        if sid in _store:
            _store[sid]["history"].append(entry)
            _store[sid]["last_active"] = time.time()


def mark_complete(sid: str) -> None:
    with _lock:
        if sid in _store:
            _store[sid]["complete"] = True


def cleanup_expired() -> int:
    now = time.time()
    removed = 0
    with _lock:
        expired = [
            sid for sid, sess in _store.items()
            if now - sess["last_active"] > SESSION_TTL_SECONDS
        ]
        for sid in expired:
            del _store[sid]
            removed += 1
    return removed


def active_count() -> int:
    with _lock:
        return len(_store)
