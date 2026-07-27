"""
Persistent mock data storage with JSON file backing.
Data is kept in memory for fast reads and persisted to disk on writes.
Survives container restarts and sleep/wake cycles.
"""
import json
import os
import uuid
import threading
from datetime import datetime, timezone
from typing import Optional

# --- Config ---
# 默认使用项目目录下的 data/，避免 /tmp 在部署重启时被清空
_DEFAULT_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
DATA_DIR = os.environ.get("DATA_DIR", _DEFAULT_DATA_DIR)
STORAGE_FILE = os.path.join(DATA_DIR, "mock_storage.json")

# --- In-memory dicts (loaded from disk on startup) ---
_mock_files: dict = {}
_mock_simulates: dict = {}
_mock_openings: dict = {}
_mock_extracts: dict = {}
_mock_users: dict = {}
_mock_api_keys: dict = {}

DEMO_USER_ID = "demo-user"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Persistence ---
_save_lock = threading.Lock()


def _load_from_disk():
    """Load all data from JSON file on startup."""
    global _mock_files, _mock_simulates, _mock_openings, _mock_extracts, _mock_users, _mock_api_keys
    if not os.path.exists(STORAGE_FILE):
        return
    try:
        with open(STORAGE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        _mock_files = data.get("files", {})
        _mock_simulates = data.get("simulates", {})
        _mock_openings = data.get("openings", {})
        _mock_extracts = data.get("extracts", {})
        _mock_users = data.get("users", {})
        _mock_api_keys = data.get("api_keys", {})
    except (json.JSONDecodeError, OSError):
        pass


def _save_to_disk():
    """Persist all data to JSON file."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with _save_lock:
        try:
            data = {
                "files": _mock_files,
                "simulates": _mock_simulates,
                "openings": _mock_openings,
                "extracts": _mock_extracts,
                "users": _mock_users,
                "api_keys": _mock_api_keys,
            }
            with open(STORAGE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except OSError:
            pass


def _init_mock_data():
    """Initialize with sample data for development (only if no persisted data)."""
    if _mock_users:
        return

    # Files
    f1_id = str(uuid.uuid4())[:8]
    f2_id = str(uuid.uuid4())[:8]
    _mock_files[f1_id] = {
        "id": f1_id,
        "original_name": "招标文件-第一包.pdf",
        "path": f"/storage/{f1_id}.enc",
        "size": 1024000,
        "type": "pdf",
        "user_id": DEMO_USER_ID,
        "created_at": _now(),
    }
    _mock_files[f2_id] = {
        "id": f2_id,
        "original_name": "投标文件-A公司.docx",
        "path": f"/storage/{f2_id}.enc",
        "size": 2048000,
        "type": "word",
        "user_id": DEMO_USER_ID,
        "created_at": _now(),
    }

    # Simulate tasks
    s1_id = str(uuid.uuid4())[:8]
    _mock_simulates[s1_id] = {
        "task_id": s1_id,
        "status": "completed",
        "current_step": 4,
        "params": {"template_type": "construction"},
        "step_results": {
            "step1": "PDF 转换完成",
            "step2": "要素提取完成",
            "step3": "对比分析完成",
            "step4": "模拟编制完成",
        },
        "file_ids": [f1_id],
        "files": [{"id": f1_id, "original_name": "招标文件-第一包.pdf", "type": "pdf"}],
        "user_id": DEMO_USER_ID,
        "created_at": _now(),
    }

    # Opening results
    o1_id = str(uuid.uuid4())[:8]
    _mock_openings[o1_id] = {
        "id": o1_id,
        "file_id": f1_id,
        "bidder_count": 5,
        "bid_ranking": [
            {"rank": 1, "name": "A公司", "price": 1150000},
            {"rank": 2, "name": "B公司", "price": 1180000},
            {"rank": 3, "name": "C公司", "price": 1250000},
            {"rank": 4, "name": "D公司", "price": 1280000},
            {"rank": 5, "name": "E公司", "price": 1320000},
        ],
        "bid_stats": {
            "mean": 1236000,
            "std": 64000,
            "cv": 5.2,
            "min": 1150000,
            "max": 1320000,
            "range": 170000,
        },
        "user_id": DEMO_USER_ID,
        "created_at": _now(),
    }

    # Extract results
    e1_id = str(uuid.uuid4())[:8]
    _mock_extracts[e1_id] = {
        "id": e1_id,
        "file_id": f1_id,
        "template_type": "construction",
        "mode": "fast",
        "content": """## 资质要求
投标人须具有建筑工程施工总承包一级资质

## 评标办法
综合评估法，商务标占60%，技术标占40%

## 业绩门槛
近三年内完成过三个以上类似项目

## 定标方法
最低价中标法

## 合同条款
合同工期12个月，付款方式为按月进度支付""",
        "user_id": DEMO_USER_ID,
        "created_at": _now(),
    }

    _save_to_disk()


# Load persisted data first, then seed demo data if empty
_load_from_disk()
_init_mock_data()


# --- CRUD Helpers (所有查询按 user_id 隔离) ---

def get_stats(user_id: str) -> dict:
    return {
        "files": sum(1 for r in _mock_files.values() if r.get("user_id") == user_id),
        "simulate_tasks": sum(1 for r in _mock_simulates.values() if r.get("user_id") == user_id),
        "opening_results": sum(1 for r in _mock_openings.values() if r.get("user_id") == user_id),
        "extract_results": sum(1 for r in _mock_extracts.values() if r.get("user_id") == user_id),
    }


def list_files(page: int = 1, page_size: int = 20, file_type: Optional[str] = None, user_id: Optional[str] = None) -> dict:
    records = [r for r in _mock_files.values() if r.get("user_id") == user_id]
    if file_type:
        records = [r for r in records if r["type"] == file_type]
    records.sort(key=lambda r: r["created_at"], reverse=True)
    total = len(records)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "files": records[start:end],
    }


def get_file(file_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    record = _mock_files.get(file_id)
    if record and user_id and record.get("user_id") != user_id:
        return None
    return record


def delete_file(file_id: str, user_id: Optional[str] = None) -> bool:
    record = _mock_files.get(file_id)
    if not record:
        return False
    if user_id and record.get("user_id") != user_id:
        return False
    del _mock_files[file_id]
    _save_to_disk()
    return True


def list_simulates(page: int = 1, page_size: int = 20, status: Optional[str] = None, user_id: Optional[str] = None) -> dict:
    records = [r for r in _mock_simulates.values() if r.get("user_id") == user_id]
    if status:
        records = [r for r in records if r["status"] == status]
    records.sort(key=lambda r: r["created_at"], reverse=True)
    total = len(records)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "tasks": records[start:end],
    }


def get_simulate(task_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    record = _mock_simulates.get(task_id)
    if record and user_id and record.get("user_id") != user_id:
        return None
    return record


def delete_simulate(task_id: str, user_id: Optional[str] = None) -> bool:
    record = _mock_simulates.get(task_id)
    if not record:
        return False
    if user_id and record.get("user_id") != user_id:
        return False
    del _mock_simulates[task_id]
    _save_to_disk()
    return True


def list_openings(page: int = 1, page_size: int = 20, user_id: Optional[str] = None) -> dict:
    records = [r for r in _mock_openings.values() if r.get("user_id") == user_id]
    records.sort(key=lambda r: r["created_at"], reverse=True)
    total = len(records)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": records[start:end],
    }


def get_opening(task_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    record = _mock_openings.get(task_id)
    if record and user_id and record.get("user_id") != user_id:
        return None
    return record


def delete_opening(task_id: str, user_id: Optional[str] = None) -> bool:
    record = _mock_openings.get(task_id)
    if not record:
        return False
    if user_id and record.get("user_id") != user_id:
        return False
    del _mock_openings[task_id]
    _save_to_disk()
    return True


def update_opening(opening_id: str, updates: dict) -> bool:
    """Update an opening analysis record."""
    if opening_id in _mock_openings:
        _mock_openings[opening_id].update(updates)
        _save_to_disk()
        return True
    return False


def list_extracts(page: int = 1, page_size: int = 20, user_id: Optional[str] = None) -> dict:
    records = [r for r in _mock_extracts.values() if r.get("user_id") == user_id]
    records.sort(key=lambda r: r["created_at"], reverse=True)
    total = len(records)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": records[start:end],
    }


def get_extract(result_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    record = _mock_extracts.get(result_id)
    if record and user_id and record.get("user_id") != user_id:
        return None
    return record


def delete_extract(result_id: str, user_id: Optional[str] = None) -> bool:
    record = _mock_extracts.get(result_id)
    if not record:
        return False
    if user_id and record.get("user_id") != user_id:
        return False
    del _mock_extracts[result_id]
    _save_to_disk()
    return True


# --- Write Helpers (register data from other modules) ---


def add_file(record: dict, user_id: Optional[str] = None) -> dict:
    """Register a file record (from upload or other source)."""
    if "id" not in record:
        record["id"] = str(uuid.uuid4())[:8]
    if "created_at" not in record:
        record["created_at"] = _now()
    if user_id:
        record["user_id"] = user_id
    _mock_files[record["id"]] = record
    _save_to_disk()
    return record


def add_simulate(record: dict, user_id: Optional[str] = None) -> dict:
    """Register a simulate task record."""
    if "task_id" not in record:
        record["task_id"] = str(uuid.uuid4())[:8]
    if "created_at" not in record:
        record["created_at"] = _now()
    if "name" not in record:
        ts = datetime.now().strftime("%m%d_%H%M")
        file_names = record.get("file_names") or []
        file_part = "_".join(n.rsplit(".", 1)[0] for n in file_names[:2]) if file_names else ""
        record["name"] = f"模拟编制_{file_part}_{ts}" if file_part else f"模拟编制_{ts}"
    if user_id:
        record["user_id"] = user_id
    _mock_simulates[record["task_id"]] = record
    _save_to_disk()
    return record


def add_opening(record: dict, user_id: Optional[str] = None) -> dict:
    """Register an opening analysis result."""
    if "id" not in record:
        record["id"] = str(uuid.uuid4())[:8]
    if "created_at" not in record:
        record["created_at"] = _now()
    if "name" not in record:
        ts = datetime.now().strftime("%m%d_%H%M")
        file_name = record.get("file_name", "")
        if file_name:
            file_part = file_name.rsplit(".", 1)[0]
            record["name"] = f"开标分析_{file_part}_{ts}"
        else:
            project_name = (record.get("meta") or {}).get("project_name", "")
            record["name"] = f"开标分析_{project_name}_{ts}" if project_name else f"开标分析_{ts}"
    if user_id:
        record["user_id"] = user_id
    _mock_openings[record["id"]] = record
    _save_to_disk()
    return record


def add_extract(record: dict, user_id: Optional[str] = None) -> dict:
    """Register an extraction result."""
    if "id" not in record:
        record["id"] = str(uuid.uuid4())[:8]
    if "created_at" not in record:
        record["created_at"] = _now()
    if "name" not in record:
        ts = datetime.now().strftime("%m%d_%H%M")
        file_name = record.get("file_name", "")
        if file_name:
            file_part = file_name.rsplit(".", 1)[0]
            record["name"] = f"要素提取_{file_part}_{ts}"
        else:
            template = record.get("template_type", "")
            record["name"] = f"要素提取_{template}_{ts}" if template else f"要素提取_{ts}"
    if user_id:
        record["user_id"] = user_id
    _mock_extracts[record["id"]] = record
    _save_to_disk()
    return record


def update_file(file_id: str, updates: dict) -> bool:
    """Update a file record."""
    if file_id in _mock_files:
        _mock_files[file_id].update(updates)
        _save_to_disk()
        return True
    return False


def update_simulate(task_id: str, updates: dict) -> bool:
    """Update a simulate task record."""
    if task_id in _mock_simulates:
        _mock_simulates[task_id].update(updates)
        _save_to_disk()
        return True
    return False


# --- User Helpers ---


def add_user(record: dict) -> dict:
    """Register a user record."""
    if "id" not in record:
        record["id"] = str(uuid.uuid4())[:8]
    if "created_at" not in record:
        record["created_at"] = _now()
    _mock_users[record["id"]] = record
    _save_to_disk()
    return record


def get_user_by_username(username: str) -> Optional[dict]:
    """Find a user by username."""
    for user in _mock_users.values():
        if user.get("username") == username:
            return user
    return None


def get_user_by_email(email: str) -> Optional[dict]:
    """Find a user by email."""
    for user in _mock_users.values():
        if user.get("email") == email:
            return user
    return None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Find a user by ID."""
    return _mock_users.get(user_id)


# ==============================================
# API Key Storage
# ==============================================


def save_api_key(user_id: str, provider: str, encrypted_key: str) -> dict:
    """Save or update an encrypted API key for a user/provider pair."""
    key = f"{user_id}:{provider}"
    record = {
        "user_id": user_id,
        "provider": provider,
        "encrypted_key": encrypted_key,
        "updated_at": _now(),
    }
    _mock_api_keys[key] = record
    _save_to_disk()
    return record


def get_api_key(user_id: str, provider: str) -> Optional[str]:
    """Get encrypted API key for a user/provider pair. Returns None if not found."""
    record = _mock_api_keys.get(f"{user_id}:{provider}")
    return record["encrypted_key"] if record else None


def delete_api_key(user_id: str, provider: str) -> bool:
    """Delete API key for a user/provider pair."""
    key = f"{user_id}:{provider}"
    if key in _mock_api_keys:
        del _mock_api_keys[key]
        _save_to_disk()
        return True
    return False


def list_user_api_keys(user_id: str) -> list[dict]:
    """List all providers for which a user has stored keys (no sensitive data returned)."""
    return [
        {"provider": v["provider"], "updated_at": v["updated_at"]}
        for v in _mock_api_keys.values()
        if v["user_id"] == user_id
    ]


# ==============================================
# Verification Code Storage (in-memory, not persisted)
# ==============================================
_verification_codes: dict = {}


def save_verification_code(email: str, code: str, expires_at: datetime) -> None:
    _verification_codes[email] = {"code": code, "expires_at": expires_at.isoformat()}


def verify_code(email: str, code: str) -> bool:
    record = _verification_codes.get(email)
    if not record:
        return False
    if record["code"] != code:
        return False
    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        del _verification_codes[email]
        return False
    return True


def delete_verification_code(email: str) -> None:
    _verification_codes.pop(email, None)


# ==============================================
# Password Reset Token Storage (in-memory, not persisted)
# ==============================================
_reset_tokens: dict = {}


def save_reset_token(token: str, user_id: str, expires_at: datetime) -> None:
    _reset_tokens[token] = {"user_id": user_id, "expires_at": expires_at.isoformat()}


def get_reset_token(token: str) -> Optional[dict]:
    record = _reset_tokens.get(token)
    if not record:
        return None
    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        del _reset_tokens[token]
        return None
    return record


def delete_reset_token(token: str) -> None:
    _reset_tokens.pop(token, None)


def update_user_password(user_id: str, password_hash: str, salt_hex: str) -> bool:
    user = _mock_users.get(user_id)
    if not user:
        return False
    user["password_hash"] = password_hash
    user["salt"] = salt_hex
    _save_to_disk()
    return True
