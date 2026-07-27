"""
Authentication API routes: register, login, refresh, logout, me, send-code, forgot-password, reset-password.
"""
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Response, Request
from app.models.schemas import (
    RegisterRequest, LoginRequest, RefreshRequest,
    SendCodeRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from app.infrastructure.pg_storage import (
    add_user, get_user_by_username, get_user_by_email, get_user_by_id,
    save_verification_code, verify_code, delete_verification_code,
    save_reset_token, get_reset_token, delete_reset_token, update_user_password,
)
from app.infrastructure.email_service import send_verification_code as email_send_code, send_reset_link
from app.utils.crypto import (
    generate_salt, hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


_IS_PRODUCTION = os.getenv("BID_MASTER_ENV", "development").lower() == "production"


@router.post("/send-code")
async def send_code(request: SendCodeRequest):
    """发送邮箱验证码（注册用）。"""
    existing = await get_user_by_email(request.email)
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    code = f"{random.randint(0, 999999):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    await save_verification_code(request.email, code, expires_at)

    success, err_msg = await email_send_code(request.email, code)
    if not success:
        raise HTTPException(status_code=500, detail=f"验证码发送失败: {err_msg}")

    return {"success": True, "message": "验证码已发送"}


@router.post("/register")
async def register(request: RegisterRequest, response: Response):
    """注册新用户（需要邮箱验证码）。"""
    if request.password != request.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")

    if not await verify_code(request.email, request.code):
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    existing = await get_user_by_email(request.email)
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    # 自动生成用户名（如果未提供）
    username = request.username
    if not username:
        base = request.email.split("@")[0].replace(".", "_")
        username = base
        suffix = 1
        while await get_user_by_username(username):
            username = f"{base}{suffix}"
            suffix += 1

    # 检查用户名是否已被占用
    if await get_user_by_username(username):
        raise HTTPException(status_code=400, detail="用户名已被使用")

    salt = generate_salt()
    password_hash = hash_password(request.password, salt)

    user = await add_user({
        "username": username,
        "email": request.email,
        "password_hash": password_hash,
        "salt": salt.hex(),
        "role": "user",
        "is_active": True,
    })

    await delete_verification_code(request.email)

    settings = get_settings()
    access_token = create_access_token(
        {"sub": user["id"], "username": user["username"], "email": user["email"], "role": user["role"]},
        settings.jwt_secret,
        settings.jwt_access_token_expire_minutes,
    )
    refresh_token = create_refresh_token(
        {"sub": user["id"]},
        settings.jwt_secret,
        settings.jwt_refresh_token_expire_days,
    )

    # refresh_token 设为 httpOnly cookie（与登录一致）
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        httponly=True,
        secure=bool(_IS_PRODUCTION),
        samesite="lax",
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "username": user["username"], "email": user.get("email"), "role": user["role"]},
    }


@router.post("/login")
async def login(request: LoginRequest, response: Response):
    """邮箱登录。"""
    user = await get_user_by_email(request.email)
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    salt_bytes = bytes.fromhex(user["salt"])
    if not verify_password(request.password, salt_bytes, user["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    settings = get_settings()
    access_token = create_access_token(
        {"sub": user["id"], "username": user["username"], "email": user.get("email"), "role": user["role"]},
        settings.jwt_secret,
        settings.jwt_access_token_expire_minutes,
    )
    refresh_token = create_refresh_token(
        {"sub": user["id"]},
        settings.jwt_secret,
        settings.jwt_refresh_token_expire_days,
    )

    # refresh_token 设为 httpOnly cookie
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        httponly=True,
        secure=bool(_IS_PRODUCTION),
        samesite="lax",
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": user["id"], "username": user["username"], "email": user.get("email"), "role": user["role"]},
    }


@router.post("/refresh")
async def refresh(request: Request):
    """用 httpOnly cookie 中的 refresh_token 获取新的 access_token。"""
    import logging
    _log = logging.getLogger(__name__)

    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        _log.warning("auth refresh 失败: cookie 中缺少 refresh_token (cookies=%s)", list(request.cookies.keys()))
        raise HTTPException(status_code=401, detail="缺少 refresh token")

    payload = decode_token(refresh_token, get_settings().jwt_secret)
    if not payload:
        _log.warning("auth refresh 失败: refresh_token 解码失败（可能已过期）")
        raise HTTPException(status_code=401, detail="无效或已过期的 refresh token")
    if payload.get("type") != "refresh":
        _log.warning("auth refresh 失败: token 类型错误 (type=%s)", payload.get("type"))
        raise HTTPException(status_code=401, detail="无效的 refresh token")

    user_id = payload.get("sub")
    user = await get_user_by_id(user_id)
    if not user or not user.get("is_active"):
        _log.warning("auth refresh 失败: 用户不存在或已禁用 (sub=%s)", user_id)
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    settings = get_settings()
    access_token = create_access_token(
        {"sub": user["id"], "username": user["username"], "email": user.get("email"), "role": user["role"]},
        settings.jwt_secret,
        settings.jwt_access_token_expire_minutes,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    """退出登录，清除 refresh_token cookie。"""
    response.delete_cookie("refresh_token", secure=bool(_IS_PRODUCTION))
    return {"success": True, "message": "已退出登录"}


@router.get("/me")
async def me(request: Request):
    """获取当前用户信息。"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未认证")

    token = auth_header[7:]
    payload = decode_token(token, get_settings().jwt_secret)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="无效或过期的 token")

    user_id = payload.get("sub")
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    return {
        "id": user["id"],
        "username": user["username"],
        "email": user.get("email"),
        "role": user["role"],
    }


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """发送密码重置链接到邮箱。"""
    user = await get_user_by_email(request.email)
    if not user:
        return {"success": True, "message": "如果该邮箱已注册，重置链接已发送"}

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    await save_reset_token(token, user["id"], expires_at)

    success, err_msg = await send_reset_link(request.email, token)
    if not success:
        raise HTTPException(status_code=500, detail=f"邮件发送失败: {err_msg}")

    return {"success": True, "message": "如果该邮箱已注册，重置链接已发送"}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """通过 token 重置密码。"""
    record = await get_reset_token(request.token)
    if not record:
        raise HTTPException(status_code=400, detail="重置链接无效或已过期")

    salt = generate_salt()
    password_hash = hash_password(request.new_password, salt)
    await update_user_password(record["user_id"], password_hash, salt.hex())
    await delete_reset_token(request.token)

    return {"success": True, "message": "密码重置成功，请使用新密码登录"}