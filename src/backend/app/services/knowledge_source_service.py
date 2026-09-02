"""文件管理已有输出到知识库来源的适配服务。"""
from __future__ import annotations

import hashlib
import json
from pathlib import PurePath

from app.infrastructure.knowledge_repository import KnowledgeRepository
from app.infrastructure.knowledge_source_repository import KnowledgeSourceRepository
from app.infrastructure.pg_storage import (
    _now,
    add_file,
    get_extract,
    get_opening,
    get_simulate,
    list_extracts,
    list_openings,
    list_simulates,
)
from app.services.export_markdown_builder import build_extract_markdown, build_opening_markdown
from app.services.archive_service import SafeZipService
from app.services.file_service import FileService
from app.utils.exceptions import AppError, NotFoundError


class KnowledgeSourceService:
    def __init__(self, repository: KnowledgeSourceRepository, knowledge_repository: KnowledgeRepository):
        self.repository = repository
        self.knowledge_repository = knowledge_repository
        self.file_service = FileService()
        self.archive_service = SafeZipService()

    async def add_upload(self, knowledge_base_id: str, user_id: str, filename: str, content: bytes) -> list[dict]:
        if not await self.knowledge_repository.get(knowledge_base_id, user_id):
            raise NotFoundError("知识库不存在")
        if filename.lower().endswith(".zip"):
            pdfs = self.archive_service.read_pdfs(content)
            added: list[dict] = []
            for pdf in pdfs:
                upload = await self.file_service.upload(pdf.content, PurePath(pdf.path).name, "application/pdf")
                digest = hashlib.sha256(pdf.content).hexdigest()
                await add_file({
                    "id": upload["id"], "original_name": upload["name"], "path": upload["encrypted_path"],
                    "size": upload["size"], "type": "pdf", "file_hash": digest, "created_at": _now(),
                    "archive_entry_path": pdf.path, "managed_by": "knowledge_archive", "visibility": "internal",
                    "metadata": {"compressed_size": pdf.compressed_size, "crc": pdf.crc},
                }, user_id=user_id, encrypted_content=upload["encrypted_content"])
                source = await self.repository.create({
                    "source_type": "archive_pdf", "source_variant": "archive.pdf", "provenance_type": "original",
                    "display_name": pdf.path, "media_type": "application/pdf", "content_hash": digest,
                    "storage_file_id": upload["id"], "source_ref_id": upload["id"],
                    "source_locator": {"archive_entry_path": pdf.path},
                }, user_id)
                await self.repository.add_to_knowledge_base(knowledge_base_id, [source["id"]], user_id)
                await self.knowledge_repository.add_files(knowledge_base_id, user_id, [upload["id"]])
                added.append({"source": source, "file_id": upload["id"]})
            return added
        if not filename.lower().endswith(".pdf"):
            raise AppError("知识库上传仅支持 PDF 或 ZIP", 400, "UNSUPPORTED_KNOWLEDGE_UPLOAD")
        upload = await self.file_service.upload(content, filename, "application/pdf")
        digest = hashlib.sha256(content).hexdigest()
        await add_file({
            "id": upload["id"], "original_name": upload["name"], "path": upload["encrypted_path"],
            "size": upload["size"], "type": "pdf", "file_hash": digest, "created_at": _now(),
        }, user_id=user_id, encrypted_content=upload["encrypted_content"])
        await self.knowledge_repository.add_files(knowledge_base_id, user_id, [upload["id"]])
        source = await self.repository.ensure_file_source(upload["id"], user_id)
        return [{"source": source, "file_id": upload["id"]}]

    async def list_available(self, user_id: str) -> list[dict]:
        extracts = (await list_extracts(1, 100, user_id))["results"]
        simulates = (await list_simulates(1, 100, None, user_id))["tasks"]
        openings = (await list_openings(1, 100, user_id))["results"]
        items: list[dict] = []
        for item in extracts:
            if item.get("status") in {"completed", "completed_markdown"}:
                items.append(self._summary("extract", item["id"], "extract.content", item.get("name") or item.get("file_name"), "derived_extraction", item))
        for item in simulates:
            steps = item.get("step_results") or {}
            for step in ("step2", "step3", "step4"):
                if steps.get(step):
                    items.append(self._summary("simulate", item["task_id"], f"simulate.{step}", f"{item.get('name') or item['task_id']} · {step}", "derived_extraction" if step == "step2" else "derived_ai", item))
        for item in openings:
            if item.get("meta") or item.get("bid_ranking") or item.get("bid_stats"):
                items.append(self._summary("opening", item["id"], "opening.structured", f"{item.get('name') or item['id']} · 统计结果", "derived_structured", item))
            if item.get("ai_analysis"):
                items.append(self._summary("opening", item["id"], "opening.ai_analysis", f"{item.get('name') or item['id']} · AI分析", "derived_ai", item))
        return items

    def _summary(self, source_type: str, ref_id: str, variant: str, name: str | None, provenance: str, record: dict) -> dict:
        return {"source_type": source_type, "source_ref_id": ref_id, "source_variant": variant,
                "display_name": name or ref_id, "provenance_type": provenance, "created_at": record.get("created_at")}

    async def add_existing(self, knowledge_base_id: str, user_id: str, selections: list[dict]) -> list[dict]:
        if not await self.knowledge_repository.get(knowledge_base_id, user_id):
            raise NotFoundError("知识库不存在")
        added: list[dict] = []
        for selection in selections:
            document = await self._load(selection, user_id)
            content = document["content"].encode("utf-8")
            digest = hashlib.sha256(content).hexdigest()
            upload = await self.file_service.upload(content, f"{document['title']}.md", "text/markdown")
            await add_file({
                "id": upload["id"], "original_name": upload["name"], "path": upload["encrypted_path"],
                "size": upload["size"], "type": "md", "file_hash": digest, "created_at": _now(),
                "managed_by": "knowledge_source", "visibility": "internal",
                "metadata": {"source_type": document["source_type"], "source_variant": document["variant"],
                             "provenance_type": document["provenance"], "source_ref_id": document["ref_id"]},
            }, user_id=user_id, encrypted_content=upload["encrypted_content"])
            source = await self.repository.create({
                "source_type": document["source_type"], "source_variant": document["variant"],
                "provenance_type": document["provenance"], "display_name": document["title"],
                "media_type": "text/markdown", "content_hash": digest, "storage_file_id": upload["id"],
                "source_ref_id": document["ref_id"], "metadata": {"snapshot_file_id": upload["id"]},
            }, user_id)
            await self.repository.add_to_knowledge_base(knowledge_base_id, [source["id"]], user_id)
            await self.knowledge_repository.add_files(knowledge_base_id, user_id, [upload["id"]])
            added.append(source)
        return added

    async def _load(self, selection: dict, user_id: str) -> dict:
        source_type = selection.get("source_type")
        ref_id = selection.get("source_ref_id")
        variant = selection.get("source_variant")
        if source_type == "extract" and variant == "extract.content":
            record = await get_extract(ref_id, user_id)
            if not record or record.get("status") not in {"completed", "completed_markdown"}:
                raise AppError("要素提取结果不可用", 400, "SOURCE_UNAVAILABLE")
            content, title = build_extract_markdown(record)
            return self._document(source_type, ref_id, variant, "derived_extraction", title, content)
        if source_type == "simulate" and variant in {"simulate.step2", "simulate.step3", "simulate.step4"}:
            record = await get_simulate(ref_id, user_id)
            step = variant.rsplit(".", 1)[-1]
            value = (record or {}).get("step_results", {}).get(step)
            if not value:
                raise AppError("模拟编制结果不可用", 400, "SOURCE_UNAVAILABLE")
            content = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2)
            title = f"{record.get('name') or ref_id} · {step}"
            return self._document(source_type, ref_id, variant, "derived_extraction" if step == "step2" else "derived_ai", title, content)
        if source_type == "opening" and variant in {"opening.structured", "opening.ai_analysis"}:
            record = await get_opening(ref_id, user_id)
            if not record:
                raise AppError("开标分析结果不可用", 400, "SOURCE_UNAVAILABLE")
            if variant == "opening.ai_analysis":
                content = str(record.get("ai_analysis") or "").strip()
                provenance = "derived_ai"
            else:
                copy = {**record, "ai_analysis": ""}
                content, _ = build_opening_markdown(copy)
                provenance = "derived_structured"
            if not content:
                raise AppError("开标分析结果为空", 400, "SOURCE_UNAVAILABLE")
            return self._document(source_type, ref_id, variant, provenance, record.get("name") or ref_id, content)
        raise AppError("不支持的知识来源", 400, "INVALID_SOURCE")

    def _document(self, source_type: str, ref_id: str, variant: str, provenance: str, title: str, content: str) -> dict:
        return {"source_type": source_type, "ref_id": ref_id, "variant": variant,
                "provenance": provenance, "title": title, "content": content}
