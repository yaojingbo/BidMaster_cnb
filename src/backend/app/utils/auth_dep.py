"""
FastAPI dependency for extracting and validating current user from JWT token.
"""
from fastapi import Depends, HTTPException, Request
from app.utils.crypto import decode_token
from app.config import get_settings
from app.infrastructure.pg_storage import add_user, get_user_by_id


DEMO_USER = {
    "id": "demo-user",
    "username": "demo",
    "email": "demo@example.com",
    "password_hash": "demo-disabled-auth",
    "salt": "demo-disabled-auth",
    "role": "user",
    "is_active": True,
}


async def get_current_user(request: Request) -> dict:
    """Extract and validate user from Authorization header."""
    settings = get_settings()
    if settings.auth_disabled:
        await add_user(DEMO_USER.copy())
        return {"id": DEMO_USER["id"], "username": DEMO_USER["username"], "email": DEMO_USER["email"], "role": DEMO_USER["role"]}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未认证")

    token = auth_header[7:]
    payload = decode_token(token, settings.jwt_secret)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="无效或过期的 token")

    user_id = payload.get("sub")
    user = await get_user_by_id(user_id)
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    return {"id": user["id"], "username": user["username"], "email": user.get("email"), "role": user["role"]}