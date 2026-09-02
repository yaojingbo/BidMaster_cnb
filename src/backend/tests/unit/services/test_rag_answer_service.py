import pytest

from app.models.rag import RagExcludedFile
from app.services.rag_answer_service import REFUSAL_TEXT, RagAnswerService


class FakeAnswerGenerator:
    def __init__(self, answer: str = "投标保证金要求见文件。[1]"):
        self.answer = answer
        self.calls = 0

    async def generate(self, messages, provider, model, user_id):
        self.calls += 1
        return self.answer


CHUNK = {
    "id": "chunk-1",
    "file_id": "file-1",
    "file_name": "招标文件.pdf",
    "content": "投标保证金为10万元。",
    "score": 0.9,
    "page_start": 3,
    "page_end": 3,
    "section_path": "投标保证金",
}


@pytest.mark.asyncio
async def test_answer_returns_only_used_citations():
    service = RagAnswerService(FakeAnswerGenerator("投标保证金为10万元。[1]"))
    result = await service.answer("kb-1", "保证金是多少？", [CHUNK], [], "deepseek", None, "user-1")

    assert result.refused is False
    assert result.citations[0].chunk_id == "chunk-1"
    assert result.citations[0].citation_id == 1


@pytest.mark.asyncio
async def test_answer_refuses_invalid_citation():
    service = RagAnswerService(FakeAnswerGenerator("投标保证金为10万元。[2]"))
    result = await service.answer("kb-1", "保证金是多少？", [CHUNK], [], "deepseek", None, "user-1")

    assert result.refused is True
    assert result.answer == REFUSAL_TEXT
    assert result.citations == []


@pytest.mark.asyncio
async def test_answer_skips_llm_without_chunks():
    generator = FakeAnswerGenerator()
    service = RagAnswerService(generator)
    result = await service.answer(
        "kb-1", "不存在的问题", [], [RagExcludedFile(file_id="f", file_name="f.pdf", reason="failed")],
        "deepseek", None, "user-1",
    )

    assert result.refused is True
    assert generator.calls == 0
