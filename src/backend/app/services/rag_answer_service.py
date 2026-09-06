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
                f"[{citation_id}]\n文件：{chunk.get('file_name','')}\n页码：{page}\n"
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
                    "你是招投标领域助手，只能依据下方给定的知识库片段回答，不得引入片段之外的信息。"
                    "回答要求：① 涉及具体事实、条款、数字时，必须在句末用 [数字] 标注来源（如 [1]、[2]），"
                    "数字对应片段编号，禁止编造不存在的编号；② 可以基于多个片段归纳、概括、总结；"
                    f"③ 仅当所有片段都与问题无关、确实没有可依据的信息时，才只回答“{REFUSAL_TEXT}”。"
                ),
            },
            {"role": "user", "content": f"问题：{question}\n\n" + "\n\n".join(context_parts)},
        ]
        answer = await self.generator.generate(messages, provider, model, user_id)
        if REFUSAL_TEXT in answer:
            # 保留 LLM 给出的具体拒绝原因（如「片段涉及 A、B 项目，未提及 X」），
            # 而不是一律替换成笼统的 REFUSAL_TEXT。
            return RagQueryResult(answer=answer.strip(), refused=True, excluded_files=excluded_files)
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
