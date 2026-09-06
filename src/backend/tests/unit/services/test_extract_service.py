"""要素提取空响应防护测试。

回归场景：供应商配额用尽 / 模型异常时，LLM 流返回空内容，
旧代码仍落库 status=completed（空 content/elements），前端显示「提取完成」但预览为空。
修复后：空响应应产出 error 事件、不落库为 completed。
"""
import json

import pytest

from app.services.extract_service import ExtractService


class _FakeLiteLLM:
    MODEL_MAP = {"deepseek": "deepseek/deepseek-chat"}

    async def complete(self, *args, **kwargs):
        # 空流：不产出任何 chunk，模拟供应商返回空内容
        if False:
            yield ""


class _JsonLiteLLM:
    MODEL_MAP = {"deepseek": "deepseek/deepseek-chat"}

    async def complete(self, *args, **kwargs):
        yield json.dumps(
            {"elements": [{"name": "项目基本信息", "content": "测试内容"}]},
            ensure_ascii=False,
        )


class _FakeLLMService:
    def __init__(self, lite_llm):
        self.llm = lite_llm


_MESSAGES = [
    {"role": "system", "content": "system"},
    {"role": "user", "content": "user"},
]


@pytest.mark.asyncio
async def test_空响应产出错误事件且不落库(monkeypatch):
    saved = []
    async def _fake_get_file(file_id, user_id):
        return {"original_name": "test.pdf", "file_hash": "abc"}
    async def _fake_add_extract(record, user_id=None):
        saved.append(record)

    monkeypatch.setattr("app.services.extract_service.get_file", _fake_get_file)
    monkeypatch.setattr("app.services.extract_service.add_extract", _fake_add_extract)

    svc = ExtractService(llm_service=_FakeLLMService(_FakeLiteLLM()), file_service=None)
    events = [
        event
        async for event in svc._stream_llm_with_progress(
            "deepseek", _MESSAGES, None, "file-1", "standard", user_id="u1"
        )
    ]

    assert any(event.get("type") == "error" for event in events), events
    assert not any(event.get("type") == "done" for event in events), events
    assert not any(record.get("status") == "completed" for record in saved), saved


@pytest.mark.asyncio
async def test_非空响应正常落库completed(monkeypatch):
    saved = []
    async def _fake_get_file(file_id, user_id):
        return {"original_name": "test.pdf", "file_hash": "abc"}
    async def _fake_add_extract(record, user_id=None):
        saved.append(record)

    monkeypatch.setattr("app.services.extract_service.get_file", _fake_get_file)
    monkeypatch.setattr("app.services.extract_service.add_extract", _fake_add_extract)

    svc = ExtractService(llm_service=_FakeLLMService(_JsonLiteLLM()), file_service=None)
    events = [
        event
        async for event in svc._stream_llm_with_progress(
            "deepseek", _MESSAGES, None, "file-1", "standard", user_id="u1"
        )
    ]

    assert any(event.get("type") == "done" for event in events), events
    completed = [record for record in saved if record.get("status") == "completed"]
    assert completed, saved
    assert completed[0]["elements"], completed[0]
