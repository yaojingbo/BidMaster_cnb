"""
日志查询 API 路由。
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.utils.auth_dep import get_current_user
from app.infrastructure.log_collector import get_logs, clear_logs

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def list_logs(
    limit: int = Query(100, ge=1, le=500),
    level: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    logs = get_logs(limit=limit, level=level, user_id=current_user["id"])
    return {"success": True, "logs": logs}


@router.delete("")
async def delete_logs(current_user: dict = Depends(get_current_user)):
    count = clear_logs(user_id=current_user["id"])
    return {"success": True, "deleted": count}
