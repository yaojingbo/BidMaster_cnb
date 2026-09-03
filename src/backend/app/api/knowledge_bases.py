"""知识库与 RAG API。"""
from __future__ import annotations

import json
import time
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.models.rag import (
    KnowledgeBaseCreate,
    KnowledgeBaseFileAdd,
    KnowledgeBaseUpdate,
    KnowledgeSourceAdd,
    RagExcludedFile,
    RagIndexJobCreate,
    RagQueryRequest,
)
from app.services.rag_dependencies import build_rag_services, ensure_rag_available, get_task_runner
from app.utils.auth_dep import get_current_user
from app.utils.exceptions import AppError, NotFoundError
from app.infrastructure.rag_service_client import RagServiceClient
from app.limiter import limiter


router = APIRouter(prefix="/knowledge-bases", tags=["knowledge-bases"])


async def _services() -> dict:
    ensure_rag_available()
    return await build_rag_services()


def _rag_service_client() -> RagServiceClient | None:
    settings = get_settings()
    if not settings.rag_service_enabled:
        return None
    if not settings.rag_internal_token:
        raise AppError("知识库服务配置不完整", 503, "RAG_SERVICE_NOT_CONFIGURED")
    return RagServiceClient(
        settings.rag_service_url,
        settings.rag_internal_token,
        settings.rag_service_timeout_seconds,
    )


async def _resource_request(
    method: str,
    path: str,
    user_id: str,
    *,
    payload: dict | None = None,
    params: dict | None = None,
) -> dict | None:
    client = _rag_service_client()
    if not client:
        return None
    return await client.request(method, path, user_id, json=payload, params=params)


@router.post("/rag/query")
async def rag_query(payload: RagQueryRequest, user: dict = Depends(get_current_user)):
    """直接调用独立 RAG 服务的语义问答（Mastra + Milvus），返回 { answer, sources }。"""
    response = await _resource_request(
        "POST",
        "/internal/v1/rag/query",
        user["id"],
        payload={"question": payload.question},
    )
    if not response or not isinstance(response, dict) or not response.get("data"):
        raise AppError("知识库服务返回无效响应", 502, "RAG_RESPONSE_INVALID")
    return {"success": True, "data": response["data"]}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(payload: KnowledgeBaseCreate, user: dict = Depends(get_current_user)):
    response = await _resource_request(
        "POST",
        "/internal/v1/knowledge-bases",
        user["id"],
        payload=payload.model_dump(),
    )
    if response is not None:
        return {"success": True, "data": response["data"]}
    services = await _services()
    item = await services["knowledge"].create(user["id"], payload.name, payload.description)
    return {"success": True, "data": item}


@router.get("")
async def list_knowledge_bases(
    search: str = Query("", max_length=200),
    user: dict = Depends(get_current_user),
):
    response = await _resource_request(
        "GET",
        "/internal/v1/knowledge-bases",
        user["id"],
        params={"search": search} if search else None,
    )
    if response is not None:
        return {"success": True, "data": response["data"]}
    services = await _services()
    return {"success": True, "data": {"items": await services["knowledge"].list(user["id"], search)}}


@router.get("/{knowledge_base_id}")
async def get_knowledge_base(knowledge_base_id: str, user: dict = Depends(get_current_user)):
    response = await _resource_request(
        "GET", f"/internal/v1/knowledge-bases/{knowledge_base_id}", user["id"],
    )
    if response is not None:
        return {"success": True, "data": response["data"]}
    services = await _services()
    return {"success": True, "data": await services["knowledge"].detail(knowledge_base_id, user["id"])}


@router.patch("/{knowledge_base_id}")
async def update_knowledge_base(
    knowledge_base_id: str,
    payload: KnowledgeBaseUpdate,
    user: dict = Depends(get_current_user),
):
    response = await _resource_request(
        "PATCH",
        f"/internal/v1/knowledge-bases/{knowledge_base_id}",
        user["id"],
        payload=payload.model_dump(exclude_none=True),
    )
    if response is not None:
        return {"success": True, "data": response["data"]}
    services = await _services()
    item = await services["knowledge"].update(
        knowledge_base_id, user["id"], payload.name, payload.description,
    )
    return {"success": True, "data": item}


@router.delete("/{knowledge_base_id}")
async def delete_knowledge_base(knowledge_base_id: str, user: dict = Depends(get_current_user)):
    response = await _resource_request(
        "DELETE", f"/internal/v1/knowledge-bases/{knowledge_base_id}", user["id"],
    )
    if response is not None:
        return {"success": True, "message": response.get("message", "知识库已删除，原始文件保持不变")}
    services = await _services()
    await services["knowledge"].delete(knowledge_base_id, user["id"])
    return {"success": True, "message": "知识库已删除，原始文件保持不变"}


@router.post("/{knowledge_base_id}/files")
async def add_knowledge_files(
    knowledge_base_id: str,
    payload: KnowledgeBaseFileAdd,
    user: dict = Depends(get_current_user),
):
    services = await _services()
    data = await services["knowledge"].add_files(knowledge_base_id, user["id"], payload.file_ids)
    return {"success": True, "data": data}


@router.get("/{knowledge_base_id}/files")
async def list_knowledge_files(knowledge_base_id: str, user: dict = Depends(get_current_user)):
    services = await _services()
    detail = await services["knowledge"].detail(knowledge_base_id, user["id"])
    return {"success": True, "data": {"files": detail["files"]}}


@router.delete("/{knowledge_base_id}/files/{file_id}")
async def remove_knowledge_file(
    knowledge_base_id: str,
    file_id: str,
    user: dict = Depends(get_current_user),
):
    services = await _services()
    await services["knowledge"].remove_file(knowledge_base_id, file_id, user["id"])
    return {"success": True, "message": "文件已从知识库移除，原始文件保持不变"}


@router.post("/{knowledge_base_id}/source-uploads")
async def upload_knowledge_source(
    knowledge_base_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    services = await _services()
    content = await file.read()
    items = await services["sources"].add_upload(
        knowledge_base_id, user["id"], file.filename or "upload", content,
    )
    return {"success": True, "data": {"items": items}}


@router.get("/{knowledge_base_id}/available-sources")
async def list_available_sources(knowledge_base_id: str, user: dict = Depends(get_current_user)):
    services = await _services()
    if not await services["knowledge_repository"].get(knowledge_base_id, user["id"]):
        raise NotFoundError("知识库不存在")
    return {"success": True, "data": {"items": await services["sources"].list_available(user["id"])}}


@router.post("/{knowledge_base_id}/sources")
async def add_existing_sources(
    knowledge_base_id: str,
    payload: KnowledgeSourceAdd,
    user: dict = Depends(get_current_user),
):
    services = await _services()
    items = await services["sources"].add_existing(
        knowledge_base_id, user["id"], [item.model_dump() for item in payload.sources],
    )
    return {"success": True, "data": {"items": items}}


@router.get("/{knowledge_base_id}/sources")
async def list_knowledge_sources(knowledge_base_id: str, user: dict = Depends(get_current_user)):
    services = await _services()
    if not await services["knowledge_repository"].get(knowledge_base_id, user["id"]):
        raise NotFoundError("知识库不存在")
    items = await services["source_repository"].list_members(knowledge_base_id, user["id"])
    return {"success": True, "data": {"items": items}}


@router.delete("/{knowledge_base_id}/sources/{source_id}")
async def remove_knowledge_source(
    knowledge_base_id: str,
    source_id: str,
    user: dict = Depends(get_current_user),
):
    services = await _services()
    if not await services["source_repository"].remove_member(knowledge_base_id, source_id, user["id"]):
        raise NotFoundError("知识库中不存在该来源")
    return {"success": True, "message": "知识来源已移出知识库"}


@router.post("/{knowledge_base_id}/index-jobs", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
async def create_index_job(
    request: Request,
    knowledge_base_id: str,
    payload: RagIndexJobCreate,
    user: dict = Depends(get_current_user),
):
    services = await _services()
    job, items = await services["index"].create_job(
        knowledge_base_id, user["id"], payload.file_ids, payload.force,
    )
    runner = await get_task_runner()
    runner.submit(job, items)
    return {
        "success": True,
        "data": {
            "job_id": job["id"],
            "status": job["status"],
            "items": [
                {"file_id": item["file_id"], "index_id": item["id"], "status": item["status"], "reused": item["reused"]}
                for item in items
            ],
        },
    }


@router.get("/{knowledge_base_id}/index-jobs/active")
async def get_active_index_job(
    knowledge_base_id: str,
    user: dict = Depends(get_current_user),
):
    services = await _services()
    if not await services["knowledge_repository"].get(knowledge_base_id, user["id"]):
        raise NotFoundError("知识库不存在")
    job = await services["rag_repository"].get_active_job(knowledge_base_id, user["id"])
    if not job:
        return {"success": True, "data": None}
    items = await services["rag_repository"].list_job_items(job["id"], user["id"])
    return {"success": True, "data": {"job": job, "items": items}}


@router.get("/{knowledge_base_id}/index-jobs/{job_id}")
async def get_index_job(
    knowledge_base_id: str,
    job_id: str,
    user: dict = Depends(get_current_user),
):
    services = await _services()
    job = await services["rag_repository"].get_job(job_id, knowledge_base_id, user["id"])
    if not job:
        raise NotFoundError("索引任务不存在")
    detail = await services["knowledge"].detail(knowledge_base_id, user["id"])
    items = await services["rag_repository"].list_job_items(job_id, user["id"])
    return {"success": True, "data": {"job": job, "items": items, "files": detail["files"]}}


async def _run_query(knowledge_base_id: str, payload: RagQueryRequest, user_id: str) -> tuple[object, list[dict]]:
    services = await _services()
    if not await services["knowledge_repository"].get(knowledge_base_id, user_id):
        raise NotFoundError("知识库不存在")
    members = await services["knowledge_repository"].validate_member_files(
        knowledge_base_id, user_id, payload.file_ids,
    )
    if payload.file_ids is not None and len(members) != len(set(payload.file_ids)):
        raise AppError("部分文件不属于当前知识库", 400, "INVALID_KNOWLEDGE_FILES")
    ready = [item for item in members if item["index_status"] == "completed"]
    excluded = [
        RagExcludedFile(file_id=item["id"], file_name=item["original_name"], reason=item["index_status"])
        for item in members if item["index_status"] != "completed"
    ]
    if not ready:
        raise AppError("知识库中没有可检索的已完成索引", 409, "NO_INDEXED_FILES")
    started = time.monotonic()
    chunks = await services["retriever"].retrieve(payload.question, user_id, [item["id"] for item in ready])
    provider = payload.provider or get_settings().ai_provider
    result = await services["answer"].answer(
        knowledge_base_id, payload.question, chunks, excluded, provider, payload.model, user_id,
    )
    latency_ms = int((time.monotonic() - started) * 1000)
    await services["rag_repository"].log_query({
        "knowledge_base_id": knowledge_base_id,
        "user_id": user_id,
        "query": payload.question,
        "selected_file_ids": [item["id"] for item in ready],
        "retrieved_chunk_ids": [chunk["id"] for chunk in chunks],
        "cited_file_ids": [citation.file_id for citation in result.citations],
        "chat_provider": provider,
        "chat_model": payload.model,
        "latency_ms": latency_ms,
        "token_usage": result.usage,
        "refused": result.refused,
    })
    return result, chunks


@router.post("/{knowledge_base_id}/query")
@limiter.limit("20/minute")
async def query_knowledge_base(
    request: Request,
    knowledge_base_id: str,
    payload: RagQueryRequest,
    user: dict = Depends(get_current_user),
):
    result, _ = await _run_query(knowledge_base_id, payload, user["id"])
    return {"success": True, "data": result.model_dump()}


@router.post("/{knowledge_base_id}/query/stream")
@limiter.limit("20/minute")
async def stream_knowledge_base_query(
    request: Request,
    knowledge_base_id: str,
    payload: RagQueryRequest,
    user: dict = Depends(get_current_user),
):
    async def events():
        try:
            yield {"event": "retrieving", "data": json.dumps({"message": "正在检索知识库"}, ensure_ascii=False)}
            result, _ = await _run_query(knowledge_base_id, payload, user["id"])
            if result.excluded_files:
                yield {"event": "excluded_files", "data": result.model_dump_json(include={"excluded_files"})}
            for citation in result.citations:
                yield {"event": "citation", "data": citation.model_dump_json()}
            for start in range(0, len(result.answer), 24):
                yield {"event": "content", "data": json.dumps({"text": result.answer[start:start + 24]}, ensure_ascii=False)}
            yield {"event": "done", "data": result.model_dump_json()}
        except Exception as exc:
            yield {"event": "error", "data": json.dumps({"message": str(exc)}, ensure_ascii=False)}

    return EventSourceResponse(events())
