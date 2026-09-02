"""知识库业务服务。"""
from __future__ import annotations

from app.infrastructure.knowledge_repository import KnowledgeRepository
from app.utils.exceptions import AppError, NotFoundError


class KnowledgeBaseService:
    def __init__(self, repository: KnowledgeRepository):
        self.repository = repository

    async def create(self, user_id: str, name: str, description: str = "") -> dict:
        try:
            return await self.repository.create(user_id, name, description)
        except Exception as exc:
            if "uniq_knowledge_bases_user_name" in str(exc) or "duplicate key" in str(exc).lower():
                raise AppError("同名知识库已存在", 409, "KNOWLEDGE_BASE_NAME_EXISTS") from exc
            raise

    async def list(self, user_id: str, search: str = "") -> list[dict]:
        return await self.repository.list(user_id, search.strip())

    async def detail(self, knowledge_base_id: str, user_id: str) -> dict:
        knowledge_base = await self.repository.get(knowledge_base_id, user_id)
        if not knowledge_base:
            raise NotFoundError("知识库不存在")
        knowledge_base["files"] = await self.repository.list_files(knowledge_base_id, user_id)
        return knowledge_base

    async def update(self, knowledge_base_id: str, user_id: str, name: str | None, description: str | None) -> dict:
        current = await self.repository.get(knowledge_base_id, user_id)
        if not current:
            raise NotFoundError("知识库不存在")
        try:
            updated = await self.repository.update(
                knowledge_base_id,
                user_id,
                name if name is not None else current["name"],
                description if description is not None else current.get("description", ""),
            )
        except Exception as exc:
            if "uniq_knowledge_bases_user_name" in str(exc) or "duplicate key" in str(exc).lower():
                raise AppError("同名知识库已存在", 409, "KNOWLEDGE_BASE_NAME_EXISTS") from exc
            raise
        if not updated:
            raise NotFoundError("知识库不存在")
        return updated

    async def delete(self, knowledge_base_id: str, user_id: str) -> None:
        if not await self.repository.delete(knowledge_base_id, user_id):
            raise NotFoundError("知识库不存在")

    async def add_files(self, knowledge_base_id: str, user_id: str, file_ids: list[str]) -> dict:
        if not await self.repository.get(knowledge_base_id, user_id):
            raise NotFoundError("知识库不存在")
        added = await self.repository.add_files(knowledge_base_id, user_id, file_ids)
        unavailable = [file_id for file_id in file_ids if file_id not in set(added)]
        return {"added_file_ids": added, "unavailable_file_ids": unavailable}

    async def remove_file(self, knowledge_base_id: str, file_id: str, user_id: str) -> None:
        if not await self.repository.get(knowledge_base_id, user_id):
            raise NotFoundError("知识库不存在")
        if not await self.repository.remove_file(knowledge_base_id, file_id, user_id):
            raise NotFoundError("知识库中不存在该文件")
