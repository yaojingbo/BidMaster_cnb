"""
文件管理 API 路由：统一的 CRUD 接口，覆盖文件/模拟/开标/提取四大模块。
当前使用内存 mock 数据，数据库连接后将切换为 Drizzle ORM。
所有端点强制认证，按 user_id 隔离数据。
"""
import io
import json
import zipfile
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from urllib.parse import quote, urlparse

from pydantic import BaseModel

from app.infrastructure.pg_storage import (
    get_stats, list_files, get_file, delete_file,
    list_simulates, get_simulate, delete_simulate,
    list_openings, get_opening, delete_opening,
    list_extracts, get_extract, delete_extract,
    add_project_source, list_project_sources, get_project_source,
    update_project_source, delete_project_source, visit_project_source,
)
from app.services.file_service import get_file_service
from app.services.export_markdown_builder import (
    build_extract_markdown,
    build_opening_markdown,
    build_simulate_markdown,
)
from app.services.pdf_export_service import export_markdown_pdf
from app.utils.auth_dep import get_current_user

router = APIRouter(prefix="/data", tags=["data"])


class BatchDownloadRequest(BaseModel):
    file_ids: list[str]


class MarkdownPdfExportRequest(BaseModel):
    title: str | None = None
    source_type: str | None = None
    markdown: str
    metadata: dict | None = None


class ProjectSourceCreateRequest(BaseModel):
    name: str
    url: str
    category: str = "other"
    region: str = ""
    tags: list[str] = []
    note: str = ""
    is_favorite: bool = False
    status: str = "active"


class ProjectSourceUpdateRequest(BaseModel):
    name: str | None = None
    url: str | None = None
    category: str | None = None
    region: str | None = None
    tags: list[str] | None = None
    note: str | None = None
    is_favorite: bool | None = None
    status: str | None = None


PROJECT_SOURCE_CATEGORIES = {
    "public_resource",
    "government_procurement",
    "enterprise_procurement",
    "industry",
    "aggregator",
    "other",
}
PROJECT_SOURCE_STATUSES = {"active", "inactive", "invalid"}
PROJECT_SOURCE_SORTS = {"default", "last_visited", "updated", "created", "name", "category", "region"}


def _validate_project_source_url(url: str) -> str:
    normalized = url.strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="仅支持 http 或 https 链接")
    return normalized


def _validate_project_source_payload(data: dict, partial: bool = False) -> dict:
    payload = {key: value for key, value in data.items() if value is not None}
    if not partial or "name" in payload:
        if not str(payload.get("name", "")).strip():
            raise HTTPException(status_code=400, detail="信息源名称不能为空")
        payload["name"] = str(payload["name"]).strip()
    if not partial or "url" in payload:
        if not str(payload.get("url", "")).strip():
            raise HTTPException(status_code=400, detail="信息源链接不能为空")
        payload["url"] = _validate_project_source_url(str(payload["url"]))
    if "category" in payload and payload["category"] not in PROJECT_SOURCE_CATEGORIES:
        raise HTTPException(status_code=400, detail="信息源分类不合法")
    if "status" in payload and payload["status"] not in PROJECT_SOURCE_STATUSES:
        raise HTTPException(status_code=400, detail="信息源状态不合法")
    if "tags" in payload and len(payload["tags"]) > 10:
        raise HTTPException(status_code=400, detail="标签最多 10 个")
    if "region" in payload:
        payload["region"] = str(payload["region"]).strip()
    if "note" in payload:
        payload["note"] = str(payload["note"]).strip()
    return payload


def _pdf_response(content: bytes, filename: str) -> StreamingResponse:
    encoded_filename = quote(filename)
    return StreamingResponse(
        iter([content]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
        },
    )


# --- 统计概览 ---


@router.get("/stats")
async def api_get_stats(current_user: dict = Depends(get_current_user)):
    """获取各模块数据总数。"""
    return await get_stats(user_id=current_user["id"])


@router.post("/exports/markdown/pdf")
async def api_export_markdown_pdf(body: MarkdownPdfExportRequest, current_user: dict = Depends(get_current_user)):
    """将当前 Markdown 内容导出为智能排版 PDF。"""
    pdf = export_markdown_pdf(body.markdown, title=body.title, source_type=body.source_type)
    filename = f"{body.title or 'markdown_export'}.pdf"
    return _pdf_response(pdf, filename)


# --- 项目查询 ---


@router.get("/project-sources")
async def api_list_project_sources(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    q: Optional[str] = None,
    category: Optional[str] = None,
    region: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    status: Optional[str] = None,
    sort: str = "default",
    current_user: dict = Depends(get_current_user),
):
    """分页列出当前用户保存的项目查询信息源。"""
    if sort not in PROJECT_SOURCE_SORTS:
        raise HTTPException(status_code=400, detail="排序方式不合法")
    return await list_project_sources(
        page=page,
        page_size=page_size,
        q=q,
        category=category,
        region=region,
        is_favorite=is_favorite,
        status=status,
        sort=sort,
        user_id=current_user["id"],
    )


@router.post("/project-sources")
async def api_create_project_source(body: ProjectSourceCreateRequest, current_user: dict = Depends(get_current_user)):
    """新增项目查询信息源。"""
    payload = _validate_project_source_payload(body.model_dump())
    return await add_project_source(payload, user_id=current_user["id"])


@router.get("/project-sources/{source_id}")
async def api_get_project_source(source_id: str, current_user: dict = Depends(get_current_user)):
    """获取单个项目查询信息源。"""
    record = await get_project_source(source_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="信息源不存在或已删除")
    return record


@router.patch("/project-sources/{source_id}")
async def api_update_project_source(
    source_id: str,
    body: ProjectSourceUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """更新项目查询信息源。"""
    payload = _validate_project_source_payload(body.model_dump(exclude_unset=True), partial=True)
    if not payload:
        raise HTTPException(status_code=400, detail="更新内容不能为空")
    record = await update_project_source(source_id, payload, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="信息源不存在或已删除")
    return record


@router.delete("/project-sources/{source_id}")
async def api_delete_project_source(source_id: str, current_user: dict = Depends(get_current_user)):
    """删除项目查询信息源。"""
    deleted = await delete_project_source(source_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="信息源不存在或已删除")
    return {"success": True}


@router.post("/project-sources/{source_id}/visit")
async def api_visit_project_source(source_id: str, current_user: dict = Depends(get_current_user)):
    """记录项目查询信息源最后访问时间。"""
    record = await visit_project_source(source_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="信息源不存在或已删除")
    return record


# --- 文件管理 ---


@router.get("/files")
async def api_list_files(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    file_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """分页列出文件，可按类型筛选。"""
    return await list_files(page, page_size, file_type, user_id=current_user["id"])


@router.get("/files/{file_id}")
async def api_get_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """获取单个文件详情。"""
    record = await get_file(file_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return {"file": record}


@router.delete("/files/{file_id}")
async def api_delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """删除文件。"""
    deleted = await delete_file(file_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")
    return {"success": True}


@router.get("/files/{file_id}/download")
async def api_download_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """下载原始文件（加密存储，解密后返回）。"""
    record = await get_file(file_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        file_service = get_file_service()
        content = await file_service.download(file_id, current_user["id"])
        filename = record.get("original_name", file_id)
        encoded_filename = quote(filename)
        return StreamingResponse(
            iter([content]),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
            }
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="文件不存在（演示数据无法下载，请上传真实文件）")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/{file_id}/preview")
async def api_preview_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """预览文件（inline 返回，浏览器直接渲染）。"""
    record = await get_file(file_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        file_service = get_file_service()
        content = await file_service.download(file_id, current_user["id"])
        mime_map = {
            "pdf": "application/pdf",
            "word": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv": "text/csv",
            "markdown": "text/markdown",
        }
        mime_type = mime_map.get(record.get("type", ""), "application/octet-stream")
        filename = record.get("original_name", file_id)
        encoded_filename = quote(filename)
        return StreamingResponse(
            iter([content]),
            media_type=mime_type,
            headers={
                "Content-Disposition": f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
            }
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="文件不存在（演示数据无法预览，请上传真实文件）")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/files/batch-download")
async def api_batch_download_files(body: BatchDownloadRequest, current_user: dict = Depends(get_current_user)):
    """批量下载文件，打包为 ZIP 返回。"""
    if not body.file_ids:
        raise HTTPException(status_code=400, detail="file_ids 不能为空")

    zip_buffer = io.BytesIO()
    file_service = get_file_service()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_id in body.file_ids:
            record = await get_file(file_id, user_id=current_user["id"])
            if not record:
                continue
            try:
                content = await file_service.download(file_id, current_user["id"])
                filename = record.get("original_name", file_id)
                # 去重：同名文件加 ID 后缀
                info = zf.NameToInfo.get(filename)
                if info is not None:
                    name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "")
                    filename = f"{name}_{file_id[:8]}.{ext}" if ext else f"{name}_{file_id[:8]}"
                zf.writestr(filename, content)
            except FileNotFoundError:
                continue
            except Exception:
                continue

    zip_buffer.seek(0)
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=\"batch_download.zip\""
        }
    )


# --- 模拟任务 ---


@router.get("/simulates")
async def api_list_simulates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """分页列出模拟任务，可按状态筛选。"""
    return await list_simulates(page, page_size, status, user_id=current_user["id"])


@router.get("/simulates/{task_id}")
async def api_get_simulate(task_id: str, current_user: dict = Depends(get_current_user)):
    """获取模拟任务详情。"""
    record = await get_simulate(task_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": record}


@router.delete("/simulates/{task_id}")
async def api_delete_simulate(task_id: str, current_user: dict = Depends(get_current_user)):
    """删除模拟任务。"""
    deleted = await delete_simulate(task_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}


@router.get("/simulates/{task_id}/export-pdf")
async def api_export_simulate_pdf(task_id: str, current_user: dict = Depends(get_current_user)):
    record = await get_simulate(task_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Task not found")
    markdown, title = build_simulate_markdown(record)
    pdf = export_markdown_pdf(markdown, title=title, source_type="simulate_document")
    return _pdf_response(pdf, f"{title}.pdf")


# --- 开标结果 ---


@router.get("/openings")
async def api_list_openings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """分页列出开标分析结果。"""
    return await list_openings(page, page_size, user_id=current_user["id"])


@router.get("/openings/{task_id}")
async def api_get_opening(task_id: str, current_user: dict = Depends(get_current_user)):
    """获取开标结果详情。"""
    record = await get_opening(task_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Result not found")
    return record


@router.delete("/openings/{task_id}")
async def api_delete_opening(task_id: str, current_user: dict = Depends(get_current_user)):
    """删除开标结果。"""
    deleted = await delete_opening(task_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Result not found")
    return {"success": True}


@router.get("/openings/{task_id}/export-pdf")
async def api_export_opening_pdf(task_id: str, current_user: dict = Depends(get_current_user)):
    record = await get_opening(task_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Result not found")
    markdown, title = build_opening_markdown(record)
    pdf = export_markdown_pdf(markdown, title=title, source_type="opening_analysis")
    return _pdf_response(pdf, f"{title}.pdf")


# --- 提取结果 ---


@router.get("/extracts")
async def api_list_extracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """分页列出提取结果。"""
    return await list_extracts(page, page_size, user_id=current_user["id"])


@router.get("/extracts/{result_id}")
async def api_get_extract(result_id: str, current_user: dict = Depends(get_current_user)):
    """获取提取结果详情。"""
    record = await get_extract(result_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Result not found")
    return record


@router.get("/extracts/{result_id}/export-json")
async def api_export_extract_json(result_id: str, current_user: dict = Depends(get_current_user)):
    record = await get_extract(result_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Result not found")

    payload = {
        "id": record.get("id"),
        "file_id": record.get("file_id"),
        "file_name": record.get("file_name") or record.get("name"),
        "template_type": record.get("template_type"),
        "mode": record.get("mode"),
        "status": record.get("status"),
        "created_at": record.get("created_at"),
        "elements": record.get("elements") or [],
        "markdown_content": record.get("content") or "",
    }
    content = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    filename = quote(f"extract_{result_id}.json")
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{filename}"
        },
    )


@router.get("/extracts/{result_id}/export-pdf")
async def api_export_extract_pdf(result_id: str, current_user: dict = Depends(get_current_user)):
    record = await get_extract(result_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="Result not found")
    markdown, title = build_extract_markdown(record)
    pdf = export_markdown_pdf(markdown, title=title, source_type="extract_result")
    return _pdf_response(pdf, f"{title}.pdf")


@router.delete("/extracts/{result_id}")
async def api_delete_extract(result_id: str, current_user: dict = Depends(get_current_user)):
    """删除提取结果。"""
    deleted = await delete_extract(result_id, user_id=current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Result not found")
    return {"success": True}
