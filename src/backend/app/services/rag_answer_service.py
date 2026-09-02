"""基于检索片段生成回答并校验引用。"""
from __future__ import annotations

import re
from typing import Protocol

from app.models.rag import RagCitation, RagExcludedFile, RagQueryResult


REFUSAL_TEXT = "未在所选文件中找到足够依据"
CITATION_PATTERN = re.compile(r"\[(\d+)]")


class ChatAnswerGenerator(Protocol):
    async def generate(self, messages: list[dict], provider: str, model: str | None, user_id: str) -> str: ...


class LiteLLMAnswerGenerator:
    async def generate(self, messages: list[dict], provider: str, model: str | None, user_id: str) -> str:
        from app.infrastructure.llm.lite_llm import LiteLLMService

        chunks = []
        service = LiteLLMService()
        async for chunk in service.complete(
            provider=provider,
            messages=messages,
            model=model,
            stream=False,
            user_id=user_id,
            temperature=0.1,
        ):
            chunks.append(chunk)
        return "".join(chunks).strip()


class RagAnswerService:
    def __init__(self, generator: ChatAnswerGenerator):
        self.generator = generator

    async def answer(
        self,
        knowledge_base_id: str,
        question: str,
        chunks: list[dict],
        excluded_files: list[RagExcludedFile],
        provider: str,
        model: str | None,
        user_id: str,
    ) -> RagQueryResult:
        if not chunks:
            return RagQueryResult(answer=REFUSAL_TEXT, refused=True, excluded_files=excluded_files)

        context_parts = []
        citations: dict[int, RagCitation] = {}
        for citation_id, chunk in enumerate(chunks, 1):
            page = self._format_page(chunk.get("page_start"), chunk.get("page_end"))
            context_parts.append(
                f"[片段 {citation_id}]\n文件：{chunk.get('file_name','')}\n页码：{page}\n"
                f"章节：{chunk.get('section_path') or '未标注'}\n内容：{chunk['content']}"
            )
            citations[citation_id] = RagCitation(
                citation_id=citation_id,
                knowledge_base_id=knowledge_base_id,
                chunk_id=chunk["id"],
                file_id=chunk["file_id"],
                file_name=chunk.get("file_name", ""),
                page_start=chunk.get("page_start"),
                page_end=chunk.get("page_end"),
                section_path=chunk.get("section_path"),
                content_preview=chunk["content"][:240],
                score=float(chunk.get("score", 0)),
            )
        messages = [
            {
                "role": "system",
                "content": (
                    "你只能依据给定知识库片段回答。每个事实性结论必须使用 [编号] 引用。"
                    f"如果依据不足，只回答“{REFUSAL_TEXT}”。禁止引用不存在的编号，也不得使用常识补全。"
                ),
            },
            {"role": "user", "content": f"问题：{question}\n\n" + "\n\n".join(context_parts)},
        ]
        answer = await self.generator.generate(messages, provider, model, user_id)
        if REFUSAL_TEXT in answer:
            return RagQueryResult(answer=REFUSAL_TEXT, refused=True, excluded_files=excluded_files)
        used_ids = {int(value) for value in CITATION_PATTERN.findall(answer)}
        if not used_ids or any(value not in citations for value in used_ids):
            return RagQueryResult(answer=REFUSAL_TEXT, refused=True, excluded_files=excluded_files)
        used = [citations[value] for value in sorted(used_ids)]
        return RagQueryResult(answer=answer, citations=used, excluded_files=excluded_files)

    @staticmethod
    def _format_page(start: int | None, end: int | None) -> str:
        if start is None:
            return "未标注"
        if end is None or end == start:
            return str(start)
        return f"{start}-{end}"
