from __future__ import annotations
"""
Document extraction API routes with SSE support.
所有端点强制认证，提取结果归属当前用户。
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.services.extract_service import ExtractService
from app.models.schemas import ExtractRequest, BatchExtractRequest, ThresholdRequest
from app.limiter import limiter
from app.utils.auth_dep import get_current_user

router = APIRouter(prefix="/extract", tags=["extract"])


def _normalize_ocr_params(req) -> dict:
    page_numbers = req.ocr_pages or req.ocrPages
    engine = req.ocrEngine or req.ocr_engine or "auto"
    max_pages = req.ocrMaxPages if req.ocrMaxPages is not None else req.ocr_max_pages
    timeout_seconds = req.ocr_timeout_seconds if req.ocrTimeoutSeconds is None else req.ocrTimeoutSeconds

    if max_pages is None:
        if engine == "ocrmypdf":
            max_pages = None
        elif engine == "llm":
            max_pages = 3
        elif engine == "paddleocr":
            max_pages = 15
        else:
            max_pages = 15

    return {
        "ocr_engine": engine,
        "ocr_pages": page_numbers,
        "ocr_max_pages": max_pages,
        "ocr_timeout_seconds": timeout_seconds or 120,
    }


async def extract_elements_generator(
    request: Request,
    document_id: str,
    provider: str = "deepseek",
    model: str = None,
    template_type: str = "standard",
    elements: list[str] = None,
    mode: str = "single",
    params: dict = None,
    user_id: str = None,
):
    """
    Generate SSE events for element extraction.
    Yields properly JSON-encoded data for SSE.
    """
    extract_service = ExtractService()

    async for event in extract_service.extract_elements_stream(
        document_id, provider, model, template_type, elements, mode, params, user_id=user_id, request=request
    ):
        yield {
            "event": event.get("type", "message"),
            "data": json.dumps(event, ensure_ascii=False),
        }


@router.post("/element")
@limiter.limit("20/minute")
async def extract_element(request: Request, current_user: dict = Depends(get_current_user)):
    """单文件要素提取（SSE 流式）。限速 20次/分钟。"""
    body = await request.json()
    req = ExtractRequest(**body)
    return EventSourceResponse(
        extract_elements_generator(
            request,
            req.fileId,
            req.provider or "deepseek",
            req.model,
            req.template_type or "standard",
            req.elements,
            req.mode or "single",
            params=_normalize_ocr_params(req),
            user_id=current_user["id"],
        )
    )


# =============================================================================
# Batch & Threshold endpoints
# =============================================================================


async def extract_batch_generator(
    file_ids: list[str],
    provider: str = "deepseek",
    model: str = None,
    elements: list[str] = None,
    user_id: str = None,
    ocr_params: dict = None,
):
    extract_service = ExtractService()
    async for event in extract_service.extract_batch_stream(
        file_ids, provider, model, elements, user_id=user_id, ocr_params=ocr_params or {}
    ):
        yield {
            "event": event.get("type", "message"),
            "data": json.dumps(event, ensure_ascii=False),
        }


@router.post("/element/batch")
@limiter.limit("10/minute")
async def extract_batch(request: Request, current_user: dict = Depends(get_current_user)):
    """批量对比：多文件并行提取 + 横向对比分析。限速 10次/分钟。"""
    body = await request.json()
    req = BatchExtractRequest(**body)
    if len(req.fileIds) < 2:
        raise HTTPException(status_code=400, detail="批量对比需要至少 2 个文件")
    return EventSourceResponse(
        extract_batch_generator(
            req.fileIds,
            req.provider or "deepseek",
            req.model,
            req.elements,
            user_id=current_user["id"],
            ocr_params=_normalize_ocr_params(req),
        )
    )


async def extract_threshold_generator(
    file_id: str,
    user_qualifications: str,
    provider: str = "deepseek",
    model: str = None,
    user_id: str = None,
    ocr_params: dict = None,
):
    extract_service = ExtractService()
    async for event in extract_service.extract_threshold_stream(
        file_id, user_qualifications, provider, model, user_id=user_id, ocr_params=ocr_params or {}
    ):
        yield {
            "event": event.get("type", "message"),
            "data": json.dumps(event, ensure_ascii=False),
        }


@router.post("/element/threshold")
@limiter.limit("20/minute")
async def extract_threshold(request: Request, current_user: dict = Depends(get_current_user)):
    """门槛分析：招标文件要求 vs 用户自身条件逐项比对。限速 20次/分钟。"""
    body = await request.json()
    req = ThresholdRequest(**body)
    if not req.userQualifications.strip():
        raise HTTPException(status_code=400, detail="请填写自身资质、业绩条件")
    return EventSourceResponse(
        extract_threshold_generator(
            req.fileId,
            req.userQualifications,
            req.provider or "deepseek",
            req.model,
            user_id=current_user["id"],
            ocr_params=_normalize_ocr_params(req),
        )
    )


@router.get("/status/{task_id}")
async def get_extract_status(task_id: str, current_user: dict = Depends(get_current_user)):
    """获取提取任务状态（兼容旧版 task_id 查询）。"""
    from app.infrastructure.pg_storage import get_extract
    result = await get_extract(task_id, user_id=current_user["id"])
    if result:
        return {"success": True, "data": result}
    return {
        "success": True,
        "data": {"taskId": task_id, "status": "unknown", "progress": 0}
    }


@router.get("/result/by-file/{file_id}")
async def get_extract_result_by_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """根据文件 ID 获取最新的提取结果。"""
    from app.infrastructure.pg_storage import list_extracts
    results = await list_extracts(page=1, page_size=50, user_id=current_user["id"])
    for r in results.get("results", []):
        if r.get("file_id") == file_id:
            return {"success": True, "data": r}
    return {"success": False, "data": None, "message": "未找到提取结果"}
