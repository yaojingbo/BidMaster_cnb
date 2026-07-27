"""
File management API routes.
所有端点强制认证，文件归属当前用户。
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from app.services.file_service import FileService
from app.models.schemas import FileUploadResponse, FileListResponse, FileListItem
from app.utils.exceptions import FileTooLargeError, UnsupportedFileTypeError
from app.infrastructure.pg_storage import add_file, list_files as pg_list_files, get_file as pg_get_file, delete_file as pg_delete_file, _now, calculate_content_hash
from app.utils.auth_dep import get_current_user

router = APIRouter(prefix="/files", tags=["files"])

MIME_TYPE_EXTENSIONS = {
    "application/pdf": "pdf",
    "text/markdown": "md",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv",
}


def normalize_file_type(filename: str, mime_type: str) -> str:
    suffix = Path(filename or "").suffix.lower().lstrip(".")
    if suffix:
        return suffix[:50]
    return MIME_TYPE_EXTENSIONS.get(mime_type, (mime_type.rsplit("/", 1)[-1] if mime_type else "file"))[:50]


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Query("tender", description="Document category: tender or bid"),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload and encrypt a file.
    """
    try:
        content = await file.read()
        file_service = FileService()
        result = await file_service.upload(
            file_content=content,
            filename=file.filename,
            mime_type=file.content_type or "application/octet-stream",
            category=category,
        )

        await add_file({
            "id": result["id"],
            "original_name": result["name"],
            "path": result["encrypted_path"],
            "size": result["size"],
            "type": normalize_file_type(result["name"], result["mime_type"]),
            "file_hash": calculate_content_hash(content),
            "created_at": _now(),
        }, user_id=current_user["id"], encrypted_content=result["encrypted_content"])

        return {
            "success": True,
            "data": {
                "id": result["id"],
                "name": result["name"],
                "size": result["size"],
                "type": result["mime_type"],
                "status": result["status"],
                "createdAt": result.get("created_at", ""),
            }
        }

    except FileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except UnsupportedFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_files(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    file_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List uploaded files."""
    result = await pg_list_files(page, limit, file_type, user_id=current_user["id"])
    return {
        "success": True,
        "data": {
            "files": result["files"],
            "total": result["total"],
        },
        "pagination": {
            "page": result["page"],
            "limit": limit,
            "total": result["total"],
        }
    }


@router.get("/{file_id}")
async def get_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Get file metadata."""
    record = await pg_get_file(file_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return {
        "success": True,
        "data": {
            "id": record["id"],
            "name": record["original_name"],
            "size": record["size"],
            "mimeType": record.get("type", ""),
            "status": "ready",
        }
    }


@router.get("/{file_id}/download")
async def download_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Download and decrypt a file."""
    record = await pg_get_file(file_id, user_id=current_user["id"])
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    filename = record.get("original_name", f"{file_id}.pdf")
    try:
        file_service = FileService()
        content = await file_service.download(file_id, current_user["id"])
        encoded_filename = quote(filename)
        return StreamingResponse(
            iter([content]),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
            }
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an encrypted file."""
    try:
        file_service = FileService()
        deleted = await file_service.delete(file_id)
        await pg_delete_file(file_id, user_id=current_user["id"])
        return {
            "success": deleted,
            "message": "File deleted" if deleted else "File not found"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
