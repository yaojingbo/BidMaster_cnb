from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import get_settings
from app.infrastructure.database import get_database
from app.infrastructure.pg_storage import get_user_by_id
from app.utils.auth_dep import get_current_user
from app.utils.crypto import create_access_token

router = APIRouter(prefix="/cli-auth", tags=["cli-auth"])

DEVICE_CODE_EXPIRE_MINUTES = 10
CLI_TOKEN_EXPIRE_DAYS = 30


class CliDeviceStartResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    expires_in: int
    interval: int


class CliAuthorizeRequest(BaseModel):
    device_code: str


class CliPollRequest(BaseModel):
    device_code: str


class CliTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_device_code() -> str:
    return secrets.token_urlsafe(32)


def _new_user_code() -> str:
    raw = secrets.token_hex(4).upper()
    return f"{raw[:4]}-{raw[4:]}"


@router.post("/start", response_model=CliDeviceStartResponse)
async def start_cli_auth():
    device_code = _new_device_code()
    user_code = _new_user_code()
    expires_at = _now() + timedelta(minutes=DEVICE_CODE_EXPIRE_MINUTES)

    db = await get_database()
    await db.execute(
        """INSERT INTO cli_device_codes (device_code, user_code, status, expires_at, created_at)
           VALUES ($1, $2, 'pending', $3, $4)""",
        device_code,
        user_code,
        expires_at,
        _now(),
    )

    frontend_url = get_settings().frontend_url.rstrip("/")
    return CliDeviceStartResponse(
        device_code=device_code,
        user_code=user_code,
        verification_uri=f"{frontend_url}/cli-auth?device_code={device_code}",
        expires_in=DEVICE_CODE_EXPIRE_MINUTES * 60,
        interval=2,
    )


@router.post("/authorize")
async def authorize_cli_device(
    request: CliAuthorizeRequest,
    current_user: dict = Depends(get_current_user),
):
    db = await get_database()
    record = await db.fetch_one(
        "SELECT * FROM cli_device_codes WHERE device_code = $1",
        request.device_code,
    )
    if not record:
        raise HTTPException(status_code=404, detail="授权请求不存在")
    if record["status"] != "pending":
        raise HTTPException(status_code=400, detail="授权请求已处理")
    if record["expires_at"] < _now():
        await db.execute(
            "UPDATE cli_device_codes SET status = 'expired' WHERE device_code = $1",
            request.device_code,
        )
        raise HTTPException(status_code=400, detail="授权请求已过期")

    await db.execute(
        """UPDATE cli_device_codes
           SET status = 'authorized', user_id = $1, authorized_at = $2
           WHERE device_code = $3""",
        current_user["id"],
        _now(),
        request.device_code,
    )
    return {"success": True}


@router.post("/poll")
async def poll_cli_auth(request: CliPollRequest):
    db = await get_database()
    record = await db.fetch_one(
        "SELECT * FROM cli_device_codes WHERE device_code = $1",
        request.device_code,
    )
    if not record:
        raise HTTPException(status_code=404, detail="授权请求不存在")
    if record["expires_at"] < _now() and record["status"] == "pending":
        await db.execute(
            "UPDATE cli_device_codes SET status = 'expired' WHERE device_code = $1",
            request.device_code,
        )
        return {"status": "expired"}
    if record["status"] == "pending":
        return {"status": "pending"}
    if record["status"] != "authorized" or not record.get("user_id"):
        return {"status": record["status"]}

    user = await get_user_by_id(record["user_id"])
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    settings = get_settings()
    access_token = create_access_token(
        {
            "sub": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "role": user["role"],
            "scope": "cli",
        },
        settings.jwt_secret,
        CLI_TOKEN_EXPIRE_DAYS * 24 * 60,
    )
    await db.execute(
        "UPDATE cli_device_codes SET status = 'consumed' WHERE device_code = $1",
        request.device_code,
    )

    return CliTokenResponse(
        access_token=access_token,
        expires_in=CLI_TOKEN_EXPIRE_DAYS * 86400,
        user={"id": user["id"], "username": user["username"], "email": user.get("email"), "role": user["role"]},
    )


@router.get("/me")
async def cli_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}
