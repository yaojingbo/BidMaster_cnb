"""
API Key 管理路由 — 用户可存储自己的 LLM API Key，Fernet 加密存储。
"""
from fastapi import APIRouter, Depends, HTTPException
from app.models.schemas import ApiKeySaveRequest
from app.infrastructure.pg_storage import (
    save_api_key,
    get_api_key,
    delete_api_key,
    list_user_api_keys,
)
from app.services.encryption_service import get_encryption_service
from app.utils.auth_dep import get_current_user

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _mask_key(key: str) -> str:
    """遮蔽 API Key，只显示前 5 位和后 4 位。"""
    if len(key) <= 10:
        return key[:2] + "****" + key[-2:]
    return key[:5] + "****" + key[-4:]


@router.get("")
async def list_keys(user: dict = Depends(get_current_user)):
    """列出当前用户已存储的 API Key（masked）。"""
    records = await list_user_api_keys(user["id"])
    enc_service = get_encryption_service()
    keys = []
    for r in records:
        encrypted = await get_api_key(user["id"], r["provider"])
        if encrypted:
            try:
                plaintext = enc_service.decrypt(encrypted.encode()).decode()
                keys.append({"provider": r["provider"], "masked_key": _mask_key(plaintext)})
            except Exception:
                keys.append({"provider": r["provider"], "masked_key": None})
    return {"success": True, "data": {"keys": keys}}


@router.post("")
async def save_key(request: ApiKeySaveRequest, user: dict = Depends(get_current_user)):
    """保存或更新一个 API Key。明文传入，Fernet 加密后存储。"""
    api_key = request.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="API Key 不能为空")
    enc_service = get_encryption_service()
    encrypted = enc_service.encrypt(api_key.encode()).decode()
    await save_api_key(user["id"], request.provider, encrypted)
    return {"success": True, "message": f"API Key for {request.provider} 已保存"}


@router.delete("/{provider}")
async def remove_key(provider: str, user: dict = Depends(get_current_user)):
    """删除指定 provider 的 API Key。"""
    deleted = await delete_api_key(user["id"], provider)
    if not deleted:
        raise HTTPException(status_code=404, detail="未找到该 provider 的 API Key")
    return {"success": True, "message": f"API Key for {provider} 已删除"}
