"""
PostgreSQL-backed data storage.
Drop-in async replacement for mock_storage — same function signatures, persistent data.
"""
import json
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional

from app.infrastructure.database import get_database
from app.infrastructure import mock_storage

_USE_MOCK_STORAGE = False


def use_mock_storage() -> bool:
    return _USE_MOCK_STORAGE


def enable_mock_storage() -> None:
    global _USE_MOCK_STORAGE
    _USE_MOCK_STORAGE = True


def _mock_async(fn):
    async def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)
    return wrapper


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())[:8]


def calculate_content_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _to_dt(val) -> Optional[datetime]:
    """Convert ISO string or datetime to datetime object for asyncpg."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    return datetime.fromisoformat(val)


def _serialize_row(row: Optional[dict]) -> Optional[dict]:
    """Convert datetime fields in a row dict to ISO strings for JSON serialization."""
    if row is None:
        return None
    result = dict(row)
    for k, v in result.items():
        if isinstance(v, datetime):
            result[k] = v.isoformat()
    return result


def _serialize_rows(rows: list[dict]) -> list[dict]:
    return [_serialize_row(r) for r in rows]


def _serialize_project_source(row: Optional[dict]) -> Optional[dict]:
    result = _serialize_row(row)
    if result and isinstance(result.get("tags"), str):
        try:
            result["tags"] = json.loads(result["tags"])
        except json.JSONDecodeError:
            result["tags"] = []
    return result


def _serialize_project_sources(rows: list[dict]) -> list[dict]:
    return [item for item in (_serialize_project_source(row) for row in rows) if item is not None]


# ──────────────────────────────────────────────
# Stats
# ──────────────────────────────────────────────

async def get_stats(user_id: str) -> dict:
    db = await get_database()
    counts = {}
    for table, alias in [("files", "files"), ("simulates", "simulate_tasks"),
                         ("openings", "opening_results"), ("extracts", "extract_results")]:
        row = await db.fetch_one(f"SELECT COUNT(*) as cnt FROM {table} WHERE user_id = $1", user_id)
        counts[alias] = row["cnt"] if row else 0
    return counts


# ──────────────────────────────────────────────
# Files
# ──────────────────────────────────────────────

async def add_file(record: dict, user_id: Optional[str] = None, encrypted_content: bytes = None) -> dict:
    if "id" not in record:
        record["id"] = _new_id()
    if "created_at" not in record:
        record["created_at"] = _now()
    if user_id:
        record["user_id"] = user_id
    db = await get_database()
    await db.execute(
        """INSERT INTO files (id, original_name, path, size, type, user_id, encrypted_content, file_hash, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING""",
        record["id"], record.get("original_name", ""), record.get("path", ""),
        record.get("size", 0), record.get("type"), record.get("user_id"),
        encrypted_content, record.get("file_hash"),
        _to_dt(record.get("created_at", _now())),
    )
    return record


async def list_files(page: int = 1, page_size: int = 20, file_type: Optional[str] = None, user_id: Optional[str] = None) -> dict:
    db = await get_database()
    base = "WHERE user_id = $1"
    args = [user_id]
    if file_type:
        base += " AND type = $2"
        args.append(file_type)
    total_row = await db.fetch_one(f"SELECT COUNT(*) as cnt FROM files {base}", *args)
    total = total_row["cnt"] if total_row else 0
    offset = (page - 1) * page_size
    args_q = args + [page_size, offset]
    idx = len(args) + 1
    rows = await db.fetch_all(
        f"""SELECT id, original_name, path, size, type, user_id, file_hash, created_at
            FROM files {base} ORDER BY created_at DESC LIMIT ${idx} OFFSET ${idx+1}""",
        *args_q,
    )
    return {"total": total, "page": page, "page_size": page_size, "files": _serialize_rows(rows)}


async def get_file(file_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    db = await get_database()
    row = await db.fetch_one("SELECT * FROM files WHERE id = $1", file_id)
    if row and user_id and row.get("user_id") != user_id:
        return None
    return _serialize_row(row)


async def delete_file(file_id: str, user_id: Optional[str] = None) -> bool:
    db = await get_database()
    if user_id:
        result = await db.execute("DELETE FROM files WHERE id = $1 AND user_id = $2", file_id, user_id)
    else:
        result = await db.execute("DELETE FROM files WHERE id = $1", file_id)
    return "DELETE 1" in result


async def update_file(file_id: str, updates: dict) -> bool:
    if not updates:
        return False
    db = await get_database()
    sets = []
    args = []
    for i, (k, v) in enumerate(updates.items(), 1):
        sets.append(f"{k} = ${i}")
        args.append(v if not isinstance(v, (dict, list)) else json.dumps(v))
    args.append(file_id)
    result = await db.execute(
        f"UPDATE files SET {', '.join(sets)} WHERE id = ${len(args)}", *args
    )
    return "UPDATE 1" in result


async def get_file_content(file_id: str, user_id: Optional[str] = None) -> Optional[bytes]:
    """获取文件的加密内容（BYTEA 列）。"""
    db = await get_database()
    if user_id:
        row = await db.fetch_one(
            "SELECT encrypted_content FROM files WHERE id = $1 AND user_id = $2",
            file_id,
            user_id,
        )
    else:
        row = await db.fetch_one("SELECT encrypted_content FROM files WHERE id = $1", file_id)
    return row["encrypted_content"] if row and row["encrypted_content"] is not None else None


async def find_completed_extract(source_hash: str, template_type: str, mode: str, elements: list[str] | None, user_id: str) -> Optional[dict]:
    if use_mock_storage():
        return None
    db = await get_database()
    rows = await db.fetch_all(
        """SELECT * FROM extracts
           WHERE user_id = $1 AND source_hash = $2 AND template_type = $3 AND mode = $4 AND status IN ('completed','completed_markdown')
           ORDER BY created_at DESC LIMIT 20""",
        user_id, source_hash, template_type, mode,
    )
    element_name_map = {
        "basic_info": "项目基本信息",
        "qualification": "资质要求",
        "experience": "业绩要求",
        "personnel": "人员要求",
        "evaluation_method": "评标办法",
        "scoring_details": "分值分配与评分细则",
        "selection_method": "定标方法",
        "contract_terms": "合同条款",
    }
    expected_names = {element_name_map.get(e, e) for e in elements} if elements else None
    for row in rows:
        if isinstance(row.get("elements"), str):
            row["elements"] = json.loads(row["elements"])
        stored_names = {e.get("name") for e in row.get("elements", []) if isinstance(e, dict)}
        if expected_names and stored_names:
            if expected_names.issubset(stored_names):
                return _serialize_row(row)
            continue
        if expected_names and not stored_names and set(elements or []) != set(element_name_map):
            continue
        return _serialize_row(row)
    return None


async def find_completed_opening(source_hash: str, modules: list[str] | None, user_id: str, require_ai: bool = False) -> Optional[dict]:
    if use_mock_storage():
        return None
    db = await get_database()
    rows = await db.fetch_all(
        """SELECT * FROM openings
           WHERE user_id = $1 AND source_hash = $2 AND status = 'completed'
           ORDER BY created_at DESC LIMIT 20""",
        user_id, source_hash,
    )
    for row in rows:
        if require_ai and not row.get("ai_analysis"):
            continue
        for key in ("meta", "bid_ranking", "bid_stats"):
            if key in row and isinstance(row[key], str):
                row[key] = json.loads(row[key])
        return _serialize_row(row)
    return None


# ──────────────────────────────────────────────
# Simulates
# ──────────────────────────────────────────────

async def add_simulate(record: dict, user_id: Optional[str] = None) -> dict:
    if "task_id" not in record:
        record["task_id"] = _new_id()
    if "created_at" not in record:
        record["created_at"] = _now()
    if "name" not in record:
        ts = datetime.now().strftime("%m%d_%H%M")
        file_names = record.get("file_names") or []
        file_part = "_".join(n.rsplit(".", 1)[0] for n in file_names[:2]) if file_names else ""
        record["name"] = f"模拟编制_{file_part}_{ts}" if file_part else f"模拟编制_{ts}"
    if user_id:
        record["user_id"] = user_id
    db = await get_database()
    await db.execute(
        """INSERT INTO simulates (task_id, name, status, current_step, params, step_results, file_ids, files, file_names, source_hash, user_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (task_id) DO NOTHING""",
        record["task_id"], record.get("name"), record.get("status", "pending"),
        record.get("current_step", 0), json.dumps(record.get("params", {})),
        json.dumps(record.get("step_results", {})), json.dumps(record.get("file_ids", [])),
        json.dumps(record.get("files", [])), json.dumps(record.get("file_names", [])),
        record.get("source_hash"), record.get("user_id"), _to_dt(record.get("created_at", _now())),
    )
    return record


async def list_simulates(page: int = 1, page_size: int = 20, status: Optional[str] = None, user_id: Optional[str] = None) -> dict:
    db = await get_database()
    base = "WHERE user_id = $1"
    args = [user_id]
    if status:
        base += " AND status = $2"
        args.append(status)
    total_row = await db.fetch_one(f"SELECT COUNT(*) as cnt FROM simulates {base}", *args)
    total = total_row["cnt"] if total_row else 0
    offset = (page - 1) * page_size
    args_q = args + [page_size, offset]
    idx = len(args) + 1
    rows = await db.fetch_all(
        f"SELECT * FROM simulates {base} ORDER BY created_at DESC LIMIT ${idx} OFFSET ${idx+1}", *args_q
    )
    for r in rows:
        for k in ("params", "step_results", "file_ids", "files", "file_names"):
            if k in r and isinstance(r[k], str):
                r[k] = json.loads(r[k])
    return {"total": total, "page": page, "page_size": page_size, "tasks": _serialize_rows(rows)}


async def get_simulate(task_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    db = await get_database()
    row = await db.fetch_one("SELECT * FROM simulates WHERE task_id = $1", task_id)
    if not row:
        return None
    if user_id and row.get("user_id") != user_id:
        return None
    for k in ("params", "step_results", "file_ids", "files", "file_names"):
        if k in row and isinstance(row[k], str):
            row[k] = json.loads(row[k])
    return _serialize_row(row)


async def delete_simulate(task_id: str, user_id: Optional[str] = None) -> bool:
    db = await get_database()
    if user_id:
        result = await db.execute("DELETE FROM simulates WHERE task_id = $1 AND user_id = $2", task_id, user_id)
    else:
        result = await db.execute("DELETE FROM simulates WHERE task_id = $1", task_id)
    return "DELETE 1" in result


async def update_simulate(task_id: str, updates: dict) -> bool:
    if not updates:
        return False
    db = await get_database()
    sets = []
    args = []
    for i, (k, v) in enumerate(updates.items(), 1):
        sets.append(f"{k} = ${i}")
        args.append(json.dumps(v) if isinstance(v, (dict, list)) else v)
    args.append(task_id)
    result = await db.execute(
        f"UPDATE simulates SET {', '.join(sets)} WHERE task_id = ${len(args)}", *args
    )
    return "UPDATE 1" in result


# ──────────────────────────────────────────────
# Openings
# ──────────────────────────────────────────────

async def add_opening(record: dict, user_id: Optional[str] = None) -> dict:
    if "id" not in record:
        record["id"] = _new_id()
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
    db = await get_database()
    await db.execute(
        """INSERT INTO openings (id, name, file_id, file_name, meta, bidder_count, bid_ranking, bid_stats, ai_analysis, status, source_hash, user_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING""",
        record["id"], record.get("name"), record.get("file_id"), record.get("file_name"),
        json.dumps(record.get("meta", {})), record.get("bidder_count", 0),
        json.dumps(record.get("bid_ranking", [])), json.dumps(record.get("bid_stats", {})),
        record.get("ai_analysis"), record.get("status", "completed"), record.get("source_hash"),
        record.get("user_id"), _to_dt(record.get("created_at", _now())),
    )
    return record


async def list_openings(page: int = 1, page_size: int = 20, user_id: Optional[str] = None) -> dict:
    db = await get_database()
    total_row = await db.fetch_one("SELECT COUNT(*) as cnt FROM openings WHERE user_id = $1", user_id)
    total = total_row["cnt"] if total_row else 0
    offset = (page - 1) * page_size
    rows = await db.fetch_all(
        "SELECT * FROM openings WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        user_id, page_size, offset,
    )
    for r in rows:
        for k in ("meta", "bid_ranking", "bid_stats"):
            if k in r and isinstance(r[k], str):
                r[k] = json.loads(r[k])
    return {"total": total, "page": page, "page_size": page_size, "results": _serialize_rows(rows)}


async def get_opening(task_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    db = await get_database()
    row = await db.fetch_one("SELECT * FROM openings WHERE id = $1", task_id)
    if not row:
        return None
    if user_id and row.get("user_id") != user_id:
        return None
    for k in ("meta", "bid_ranking", "bid_stats"):
        if k in row and isinstance(row[k], str):
            row[k] = json.loads(row[k])
    return _serialize_row(row)


async def delete_opening(task_id: str, user_id: Optional[str] = None) -> bool:
    db = await get_database()
    if user_id:
        result = await db.execute("DELETE FROM openings WHERE id = $1 AND user_id = $2", task_id, user_id)
    else:
        result = await db.execute("DELETE FROM openings WHERE id = $1", task_id)
    return "DELETE 1" in result


async def update_opening(opening_id: str, updates: dict) -> bool:
    if not updates:
        return False
    db = await get_database()
    sets = []
    args = []
    for i, (k, v) in enumerate(updates.items(), 1):
        sets.append(f"{k} = ${i}")
        args.append(json.dumps(v) if isinstance(v, (dict, list)) else v)
    args.append(opening_id)
    result = await db.execute(
        f"UPDATE openings SET {', '.join(sets)} WHERE id = ${len(args)}", *args
    )
    return "UPDATE 1" in result


# ──────────────────────────────────────────────
# Extracts
# ──────────────────────────────────────────────

async def add_extract(record: dict, user_id: Optional[str] = None) -> dict:
    if "id" not in record:
        record["id"] = _new_id()
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
    db = await get_database()
    await db.execute(
        """INSERT INTO extracts (id, name, file_id, file_name, template_type, mode, content, elements, status, source_hash, user_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING""",
        record["id"], record.get("name"), record.get("file_id"), record.get("file_name"),
        record.get("template_type"), record.get("mode"), record.get("content"),
        json.dumps(record.get("elements", [])), record.get("status", "completed"), record.get("source_hash"),
        record.get("user_id"), _to_dt(record.get("created_at", _now())),
    )
    return record


async def list_extracts(page: int = 1, page_size: int = 20, user_id: Optional[str] = None) -> dict:
    db = await get_database()
    total_row = await db.fetch_one("SELECT COUNT(*) as cnt FROM extracts WHERE user_id = $1", user_id)
    total = total_row["cnt"] if total_row else 0
    offset = (page - 1) * page_size
    rows = await db.fetch_all(
        "SELECT * FROM extracts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        user_id, page_size, offset,
    )
    for r in rows:
        if "elements" in r and isinstance(r["elements"], str):
            try:
                r["elements"] = json.loads(r["elements"])
            except json.JSONDecodeError:
                r["elements"] = []
    return {"total": total, "page": page, "page_size": page_size, "results": _serialize_rows(rows)}


async def get_extract(result_id: str, user_id: Optional[str] = None) -> Optional[dict]:
    db = await get_database()
    row = await db.fetch_one("SELECT * FROM extracts WHERE id = $1", result_id)
    if not row:
        return None
    if user_id and row.get("user_id") != user_id:
        return None
    if "elements" in row and isinstance(row["elements"], str):
        try:
            row["elements"] = json.loads(row["elements"])
        except json.JSONDecodeError:
            row["elements"] = []
    return _serialize_row(row)


async def delete_extract(result_id: str, user_id: Optional[str] = None) -> bool:
    db = await get_database()
    if user_id:
        result = await db.execute("DELETE FROM extracts WHERE id = $1 AND user_id = $2", result_id, user_id)
    else:
        result = await db.execute("DELETE FROM extracts WHERE id = $1", result_id)
    return "DELETE 1" in result


# ──────────────────────────────────────────────
# Project Sources
# ──────────────────────────────────────────────

async def add_project_source(record: dict, user_id: str) -> dict:
    if "id" not in record:
        record["id"] = _new_id()
    now = _now()
    record["user_id"] = user_id
    record.setdefault("created_at", now)
    record.setdefault("updated_at", now)
    db = await get_database()
    await db.execute(
        """INSERT INTO project_sources
           (id, user_id, name, url, category, region, tags, note, is_favorite, status, last_visited_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (id) DO NOTHING""",
        record["id"], user_id, record.get("name", ""), record.get("url", ""),
        record.get("category", "other"), record.get("region", ""),
        json.dumps(record.get("tags", [])), record.get("note", ""),
        record.get("is_favorite", False), record.get("status", "active"),
        _to_dt(record.get("last_visited_at")), _to_dt(record["created_at"]), _to_dt(record["updated_at"]),
    )
    return _serialize_project_source(await db.fetch_one("SELECT * FROM project_sources WHERE id = $1 AND user_id = $2", record["id"], user_id))


async def list_project_sources(
    page: int = 1,
    page_size: int = 50,
    q: Optional[str] = None,
    category: Optional[str] = None,
    region: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    status: Optional[str] = None,
    sort: str = "default",
    user_id: Optional[str] = None,
) -> dict:
    db = await get_database()
    clauses = ["user_id = $1"]
    args = [user_id]
    if q:
        args.append(f"%{q}%")
        idx = len(args)
        clauses.append(f"(name ILIKE ${idx} OR url ILIKE ${idx} OR region ILIKE ${idx} OR note ILIKE ${idx})")
    if category:
        args.append(category)
        clauses.append(f"category = ${len(args)}")
    if region:
        args.append(region)
        clauses.append(f"region = ${len(args)}")
    if is_favorite is not None:
        args.append(is_favorite)
        clauses.append(f"is_favorite = ${len(args)}")
    if status:
        args.append(status)
        clauses.append(f"status = ${len(args)}")
    where_clause = "WHERE " + " AND ".join(clauses)
    sort_sql = {
        "default": "is_favorite DESC, updated_at DESC",
        "last_visited": "last_visited_at DESC NULLS LAST, updated_at DESC",
        "updated": "updated_at DESC",
        "created": "created_at DESC",
        "name": "name ASC, updated_at DESC",
        "category": "category ASC, is_favorite DESC, updated_at DESC",
        "region": "region ASC NULLS LAST, is_favorite DESC, updated_at DESC",
    }.get(sort, "is_favorite DESC, updated_at DESC")
    total_row = await db.fetch_one(f"SELECT COUNT(*) as cnt FROM project_sources {where_clause}", *args)
    total = total_row["cnt"] if total_row else 0
    offset = (page - 1) * page_size
    query_args = args + [page_size, offset]
    limit_idx = len(args) + 1
    rows = await db.fetch_all(
        f"""SELECT * FROM project_sources {where_clause}
            ORDER BY {sort_sql}
            LIMIT ${limit_idx} OFFSET ${limit_idx + 1}""",
        *query_args,
    )
    return {"total": total, "page": page, "page_size": page_size, "items": _serialize_project_sources(rows)}


async def get_project_source(source_id: str, user_id: str) -> Optional[dict]:
    db = await get_database()
    row = await db.fetch_one("SELECT * FROM project_sources WHERE id = $1 AND user_id = $2", source_id, user_id)
    return _serialize_project_source(row)


async def update_project_source(source_id: str, updates: dict, user_id: str) -> Optional[dict]:
    if not updates:
        return await get_project_source(source_id, user_id)
    db = await get_database()
    allowed_fields = {"name", "url", "category", "region", "tags", "note", "is_favorite", "status", "last_visited_at"}
    sets = []
    args = []
    for key, value in updates.items():
        if key not in allowed_fields:
            continue
        if key == "last_visited_at":
            args.append(_to_dt(value))
        else:
            args.append(json.dumps(value) if isinstance(value, (dict, list)) else value)
        sets.append(f"{key} = ${len(args)}")
    if not sets:
        return await get_project_source(source_id, user_id)
    args.append(_to_dt(_now()))
    sets.append(f"updated_at = ${len(args)}")
    args.extend([source_id, user_id])
    result = await db.execute(
        f"UPDATE project_sources SET {', '.join(sets)} WHERE id = ${len(args) - 1} AND user_id = ${len(args)}",
        *args,
    )
    if "UPDATE 1" not in result:
        return None
    return await get_project_source(source_id, user_id)


async def delete_project_source(source_id: str, user_id: str) -> bool:
    db = await get_database()
    result = await db.execute("DELETE FROM project_sources WHERE id = $1 AND user_id = $2", source_id, user_id)
    return "DELETE 1" in result


async def visit_project_source(source_id: str, user_id: str) -> Optional[dict]:
    return await update_project_source(source_id, {"last_visited_at": _now()}, user_id)


# ──────────────────────────────────────────────
# Users
# ──────────────────────────────────────────────

async def add_user(record: dict) -> dict:
    if "id" not in record:
        record["id"] = _new_id()
    if "created_at" not in record:
        record["created_at"] = _now()
    db = await get_database()
    await db.execute(
        """INSERT INTO users (id, username, email, password_hash, salt, role, is_active, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING""",
        record["id"], record["username"], record["email"],
        record["password_hash"], record["salt"],
        record.get("role", "user"), record.get("is_active", True),
        _to_dt(record.get("created_at", _now())),
    )
    return record


async def get_user_by_username(username: str) -> Optional[dict]:
    db = await get_database()
    return _serialize_row(await db.fetch_one("SELECT * FROM users WHERE username = $1", username))


async def get_user_by_email(email: str) -> Optional[dict]:
    db = await get_database()
    return _serialize_row(await db.fetch_one("SELECT * FROM users WHERE email = $1", email))


async def get_user_by_id(user_id: str) -> Optional[dict]:
    db = await get_database()
    return _serialize_row(await db.fetch_one("SELECT * FROM users WHERE id = $1", user_id))


async def update_user_password(user_id: str, password_hash: str, salt_hex: str) -> bool:
    db = await get_database()
    result = await db.execute(
        "UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3",
        password_hash, salt_hex, user_id,
    )
    return "UPDATE 1" in result


# ──────────────────────────────────────────────
# API Keys
# ──────────────────────────────────────────────

async def save_api_key(user_id: str, provider: str, encrypted_key: str) -> dict:
    db = await get_database()
    now = _now()
    await db.execute(
        """INSERT INTO api_keys (user_id, provider, encrypted_key, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, provider) DO UPDATE SET encrypted_key = $3, updated_at = $4""",
        user_id, provider, encrypted_key, _to_dt(now),
    )
    return {"user_id": user_id, "provider": provider, "encrypted_key": encrypted_key, "updated_at": now}


async def get_api_key(user_id: str, provider: str) -> Optional[str]:
    db = await get_database()
    row = await db.fetch_one(
        "SELECT encrypted_key FROM api_keys WHERE user_id = $1 AND provider = $2", user_id, provider
    )
    return row["encrypted_key"] if row else None


async def delete_api_key(user_id: str, provider: str) -> bool:
    db = await get_database()
    result = await db.execute("DELETE FROM api_keys WHERE user_id = $1 AND provider = $2", user_id, provider)
    return "DELETE 1" in result


async def list_user_api_keys(user_id: str) -> list[dict]:
    db = await get_database()
    rows = await db.fetch_all(
        "SELECT provider, updated_at FROM api_keys WHERE user_id = $1", user_id
    )
    return [{"provider": r["provider"], "updated_at": r["updated_at"].isoformat() if isinstance(r["updated_at"], datetime) else r["updated_at"]} for r in rows]


# ──────────────────────────────────────────────
# Verification Codes
# ──────────────────────────────────────────────

async def save_verification_code(email: str, code: str, expires_at: datetime) -> None:
    db = await get_database()
    await db.execute(
        """INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3""",
        email, code, expires_at,
    )


async def verify_code(email: str, code: str) -> bool:
    db = await get_database()
    row = await db.fetch_one("SELECT code, expires_at FROM verification_codes WHERE email = $1", email)
    if not row:
        return False
    if row["code"] != code:
        return False
    expires = row["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        await db.execute("DELETE FROM verification_codes WHERE email = $1", email)
        return False
    return True


async def delete_verification_code(email: str) -> None:
    db = await get_database()
    await db.execute("DELETE FROM verification_codes WHERE email = $1", email)


# ──────────────────────────────────────────────
# Reset Tokens
# ──────────────────────────────────────────────

async def save_reset_token(token: str, user_id: str, expires_at: datetime) -> None:
    db = await get_database()
    await db.execute(
        """INSERT INTO reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)
           ON CONFLICT (token) DO UPDATE SET user_id = $2, expires_at = $3""",
        token, user_id, expires_at,
    )


async def get_reset_token(token: str) -> Optional[dict]:
    db = await get_database()
    row = await db.fetch_one("SELECT user_id, expires_at FROM reset_tokens WHERE token = $1", token)
    if not row:
        return None
    expires = row["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        await db.execute("DELETE FROM reset_tokens WHERE token = $1", token)
        return None
    return _serialize_row(row)


async def delete_reset_token(token: str) -> None:
    db = await get_database()
    await db.execute("DELETE FROM reset_tokens WHERE token = $1", token)


async def _mock_get_file_content(file_id: str) -> Optional[bytes]:
    return None


def _dispatch(name: str, original, transform=None):
    async def wrapper(*args, **kwargs):
        if use_mock_storage():
            if transform:
                args, kwargs = transform(args, kwargs)
            return getattr(mock_storage, name)(*args, **kwargs)
        return await original(*args, **kwargs)
    return wrapper


def _drop_encrypted_content(args, kwargs):
    kwargs.pop("encrypted_content", None)
    return args, kwargs


for _name in (
    "get_stats", "list_files", "get_file", "delete_file", "update_file",
    "list_simulates", "get_simulate", "delete_simulate", "update_simulate",
    "list_openings", "get_opening", "delete_opening", "update_opening",
    "list_extracts", "get_extract", "delete_extract",
    "add_project_source", "list_project_sources", "get_project_source",
    "update_project_source", "delete_project_source", "visit_project_source",
    "add_simulate", "add_opening", "add_extract",
    "add_user", "get_user_by_username", "get_user_by_email", "get_user_by_id",
    "update_user_password", "save_api_key", "get_api_key", "delete_api_key",
    "list_user_api_keys", "save_verification_code", "verify_code",
    "delete_verification_code", "save_reset_token", "get_reset_token",
    "delete_reset_token",
):
    globals()[_name] = _dispatch(_name, globals()[_name])

add_file = _dispatch("add_file", add_file, _drop_encrypted_content)
