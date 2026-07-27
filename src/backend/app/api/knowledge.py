"""Authenticated knowledge-base API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.knowledge_service import KnowledgeService
from app.utils.auth_dep import get_current_user

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class IngestRequest(BaseModel):
    file_id: str = Field(min_length=1, max_length=64)
    force: bool = False


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int | None = Field(default=None, ge=1, le=30)
    min_score: float | None = Field(default=None, ge=0, le=1)


@router.get("/documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    items = await KnowledgeService().list_documents(current_user["id"])
    return {"success": True, "data": items}


@router.post("/documents")
async def ingest_document(payload: IngestRequest, current_user: dict = Depends(get_current_user)):
    try:
        item = await KnowledgeService().ingest(payload.file_id, current_user["id"], payload.force)
        return {"success": True, "data": item}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/documents/{document_id}/reindex")
async def reindex_document(document_id: str, current_user: dict = Depends(get_current_user)):
    service = KnowledgeService()
    items = await service.list_documents(current_user["id"])
    item = next((entry for entry in items if str(entry["id"]) == document_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="知识文档不存在")
    result = await service.ingest(str(item["file_id"]), current_user["id"], force=True)
    return {"success": True, "data": result}


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    deleted = await KnowledgeService().delete(document_id, current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="知识文档不存在")
    return {"success": True}


@router.post("/search")
async def search_knowledge(payload: SearchRequest, current_user: dict = Depends(get_current_user)):
    settings = get_settings()
    results = await KnowledgeService().search(
        payload.query.strip(),
        current_user["id"],
        payload.top_k or settings.knowledge_search_top_k,
        payload.min_score if payload.min_score is not None else settings.knowledge_search_min_score,
    )
    return {"success": True, "data": results}
