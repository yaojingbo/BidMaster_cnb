"""
内存日志收集器。
记录 API 请求和 LLM 调用日志，供前端查询。
最多保留 500 条，FIFO 淘汰。
"""
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

_logs: list[dict] = []
_lock = threading.Lock()
MAX_LOGS = 500


def add_log(
    level: str,
    category: str,
    message: str,
    detail: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict:
    entry = {
        "id": str(uuid.uuid4())[:8],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "backend",
        "level": level,
        "category": category,
        "message": message,
        "detail": detail,
        "user_id": user_id,
    }
    with _lock:
        _logs.append(entry)
        if len(_logs) > MAX_LOGS:
            _logs[:] = _logs[-MAX_LOGS:]
    return entry


def get_logs(
    limit: int = 100,
    level: Optional[str] = None,
    user_id: Optional[str] = None,
) -> list[dict]:
    with _lock:
        filtered = _logs[:]
    if user_id:
        filtered = [l for l in filtered if l.get("user_id") == user_id or l.get("user_id") is None]
    if level:
        filtered = [l for l in filtered if l["level"] == level]
    filtered.sort(key=lambda x: x["timestamp"], reverse=True)
    return filtered[:limit]


def clear_logs(user_id: Optional[str] = None) -> int:
    with _lock:
        if user_id:
            before = len(_logs)
            _logs[:] = [l for l in _logs if l.get("user_id") != user_id and l.get("user_id") is not None]
            return before - len(_logs)
        else:
            count = len(_logs)
            _logs.clear()
            return count
