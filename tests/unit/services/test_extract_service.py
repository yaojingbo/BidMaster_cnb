"""
Extract service unit tests.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.extract_service import (
    ExtractService,
    _normalize_elements,
    _parse_llm_json_response,
    _parse_markdown_elements_response,
    extract_text_from_content,
)


class TestExtractTextFromContent:
    """Tests for content text extraction helpers."""

    def test_extract_plain_utf8_text(self):
        """UTF-8 文本应直接解码。"""
        text, needs_ocr = extract_text_from_content("招标文件内容".encode("utf-8"))
        assert text == "招标文件内容"
        assert needs_ocr is False

    def test_extract_plain_gbk_text(self):
        """GBK 文本应可解码。"""
        text, needs_ocr = extract_text_from_content("招标文件内容".encode("gbk"))
        assert "招标文件内容" in text
        assert needs_ocr is False

    def test_extract_unknown_zip_returns_empty_text(self):
        """无法识别内容结构的 zip 文件应返回空文本。"""
        text, needs_ocr = extract_text_from_content(b"PK\x03\x04invalid")
        assert text == ""
        assert needs_ocr is False


class TestMarkdownElementParsing:
    def test_parse_numbered_markdown_sections(self):
        """非 JSON 输出也应按要素标题分块。"""
        elements = _parse_markdown_elements_response(
            """
一、项目基本信息
- 项目名称：污水处理厂改造

二、资质门槛
- 市政公用工程施工总承包三级及以上

三、评分细则
| 项目 | 分值 |
| --- | --- |
| 技术方案 | 30 |
"""
        )

        assert [element["name"] for element in elements] == [
            "项目基本信息",
            "资质要求",
            "分值分配与评分细则",
        ]
        assert "污水处理厂" in elements[0]["content"]
        assert "市政公用工程" in elements[1]["content"]
        assert "技术方案" in elements[2]["content"]


    def test_parse_json_mapping_as_separate_elements(self):
        """单文件 JSON 对象不应混成一个分析结果。"""
        _, elements = _parse_llm_json_response(
            """
            {
              "项目基本信息": {"项目名称": "污水处理厂改造", "预算": "100万元"},
              "资质要求": ["市政公用工程施工总承包三级及以上"],
              "评标办法": "综合评分法"
            }
            """
        )

        assert [element["name"] for element in elements] == ["项目基本信息", "资质要求", "评标办法"]
        assert "污水处理厂" in elements[0]["content"]
        assert "市政公用工程" in elements[1]["content"]
        assert "综合评分法" in elements[2]["content"]

    def test_normalize_single_json_string_content_by_selected_elements(self):
        """单个 JSON 字符串内容应按已选要素拆分成板块。"""
        elements = _normalize_elements(
            [{"name": "分析结果", "content": "项目基本信息：污水处理厂改造\n\n资质要求：市政三级\n\n评标办法：综合评分法"}],
            "",
            ["项目基本信息", "资质要求", "评标办法"],
        )

        assert [element["name"] for element in elements] == ["项目基本信息", "资质要求", "评标办法"]


class TestExtractService:
    """Tests for current ExtractService stream contract."""

    @pytest.fixture
    def file_service(self):
        service = MagicMock()
        service.download = AsyncMock(return_value="招标文件内容".encode("utf-8"))
        return service

    @pytest.fixture
    def llm_service(self):
        service = MagicMock()
        service.llm.MODEL_MAP = {"deepseek": "deepseek/deepseek-chat"}
        return service

    @pytest.fixture
    def service(self, llm_service, file_service):
        return ExtractService(llm_service=llm_service, file_service=file_service)

    @pytest.mark.asyncio
    async def test_extract_elements_stream_empty_document(self, service, file_service):
        """文档无法解析时应返回 error 事件。"""
        file_service.download.return_value = b"PK\x03\x04invalid"

        events = []
        async for event in service.extract_elements_stream("file-1"):
            events.append(event)

        assert events[0]["type"] == "progress"
        assert events[-1]["type"] == "error"
        assert events[-1]["data"]["message"] == "文档内容为空或无法解析"

    @pytest.mark.asyncio
    async def test_extract_elements_stream_delegates_to_llm_progress(self, service, file_service):
        """文档解析成功后应进入 LLM 流式阶段。"""
        async def fake_stream(*args, **kwargs):
            yield {"type": "done", "data": {"summary": "ok", "elementCount": 0}}

        with patch.object(service, "_stream_llm_with_progress", side_effect=fake_stream) as mock_stream:
            events = []
            async for event in service.extract_elements_stream("file-1", provider="deepseek"):
                events.append(event)

        file_service.download.assert_awaited_once_with("file-1", None)
        assert mock_stream.called
        assert any(event["type"] == "progress" for event in events)
        assert events[-1]["type"] == "done"

    @pytest.mark.asyncio
    async def test_extract_batch_stream_requires_two_valid_files(self, service, file_service):
        """批量对比至少需要两个有效文件。"""
        file_service.download.return_value = b"PK\x03\x04invalid"

        events = []
        async for event in service.extract_batch_stream(["file-1", "file-2"]):
            events.append(event)

        assert events[-1]["type"] == "error"
        assert "至少需要 2 个有效文件" in events[-1]["data"]["message"]
