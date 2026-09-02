"""PDF 导出服务单元测试。"""
import subprocess
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.services.pdf_export_service import (
    MAX_MARKDOWN_BYTES,
    MarkdownProfile,
    _inline_markdown_to_typst,
    _markdown_to_typst,
    _split_table_row,
    _typst_string,
    analyze_markdown,
    compile_typst_to_pdf,
    export_markdown_pdf,
    render_typst,
)


def _profile(markdown: str) -> MarkdownProfile:
    return analyze_markdown(markdown, source_type="extract_result", title="测试报告")


class TestTypstTextSafety:
    def test_typst_string_escapes_string_boundaries_and_controls(self):
        value = '反斜杠\\ 引号"\n\r\t\x01'

        assert _typst_string(value) == '"反斜杠\\\\ 引号\\"\\n\\r\\t�"'

    def test_real_batch_formula_keeps_bare_asterisks_as_text(self):
        markdown = (
            "- **控制价**：最高投标限价计算公式为（工程量清单编制造价-安全文明施工基本费）*（1-8%）\n"
            "- **总分计算**：投标人总得分=商务标得分*90%+资信标得分。"
        )

        source = render_typst(markdown, _profile(markdown))

        assert '#strong[#text("控制价")]' in source
        assert '#text("：最高投标限价计算公式为（工程量清单编制造价-安全文明施工基本费）*（1-8%）")' in source
        assert '#text("：投标人总得分=商务标得分*90%+资信标得分。")' in source
        assert "\\%" not in source

    def test_all_typst_markup_characters_stay_inside_text_literal(self):
        value = r'\ # $ @ < > [ ] * _ ` = + - / ~ % & { } "'

        converted = _inline_markdown_to_typst(value)

        assert converted.startswith('#text("')
        assert converted.endswith('")')
        assert '#raw(' not in converted
        assert '#strong[' not in converted

    def test_balanced_inline_markup_is_functional_and_unclosed_markup_is_text(self):
        converted = _inline_markdown_to_typst("**重要**公式*90%与`a*b`；**未闭合；`未闭合")

        assert '#strong[#text("重要")]' in converted
        assert '#raw("a*b")' in converted
        assert '#text("公式*90%与")' in converted
        assert '**未闭合' in converted
        assert '`未闭合' in converted


class TestMarkdownConversion:
    def test_code_blocks_use_raw_function_and_support_unclosed_fence(self):
        markdown = '````text\n含有 ``` 和 # $ [ ] * " \\\n````\n\n```python\nprint("未闭合")'

        source = _markdown_to_typst(markdown, _profile(markdown))

        assert '#raw("含有 ``` 和 # $ [ ] * \\" \\\\", block: true, lang: "text")' in source
        assert '#raw("print(\\"未闭合\\")", block: true, lang: "python")' in source

    def test_analyze_markdown_uses_the_same_code_fence_rules_as_renderer(self):
        markdown = """~~~text
# 代码中的伪标题
| A | B |
| --- | --- |
~~~

````text
```
## 仍是代码
```
````

# 正式标题
"""

        profile = analyze_markdown(markdown)

        assert profile.heading_count == 1
        assert profile.table_count == 0
        assert profile.code_block_count == 2
        assert profile.title == "正式标题"

    def test_table_keeps_escaped_and_inline_code_pipes_in_the_same_cell(self):
        markdown = (
            "| 指标 | 公式 | 代码 |\n"
            "| --- | --- | --- |\n"
            "| 商务标 | 得分*90% | `A|B` |\n"
            "| 条件 | A\\|B | **有效** |"
        )

        source = _markdown_to_typst(markdown, _profile(markdown))

        assert "columns: 3" in source
        assert '[#text("得分*90%")]' in source
        assert '[#raw("A|B")]' in source
        assert '[#text("A|B")]' in source
        assert '[#strong[#text("有效")]]' in source
        assert "[*" not in source

    def test_table_preserves_escaped_inline_markdown_as_plain_text(self):
        markdown = (
            "| 类型 | 内容 |\n"
            "| --- | --- |\n"
            r"| 文本 | \`不是代码\` |" "\n"
            r"| 文本 | \*\*不是粗体\*\* |"
        )

        source = _markdown_to_typst(markdown, _profile(markdown))

        assert '#text("`不是代码`")' in source
        assert '#text("**不是粗体**")' in source
        assert '#raw("不是代码")' not in source
        assert '#strong[#text("不是粗体")]' not in source

    @pytest.mark.parametrize(
        ("row", "expected"),
        [
            (r"| 条件 | A\|B |", ["条件", "A|B"]),
            ("| 代码 | `A|B` |", ["代码", "`A|B`"]),
            ("| 未闭合 | `A | B |", ["未闭合", "`A", "B"]),
            (r"| 转义 | \`不是代码\` | \*\*不是粗体\*\* |", ["转义", r"\`不是代码\`", r"\*\*不是粗体\*\*"]),
            ("| 普通 | A | B |", ["普通", "A", "B"]),
        ],
    )
    def test_split_table_row(self, row, expected):
        assert _split_table_row(row) == expected


class TestPdfExportBoundaries:
    def test_export_uses_shared_safe_renderer_without_real_typst(self):
        captured: dict[str, str] = {}

        def fake_compile(typst_bin: str, typst_source: str) -> bytes:
            captured["bin"] = typst_bin
            captured["source"] = typst_source
            return b"%PDF-test"

        markdown = "# 报告\n\n商务标得分*90%\n\n**重要**与`a*b`"
        with patch("app.services.pdf_export_service.shutil.which", return_value="/fake/typst"), patch(
            "app.services.pdf_export_service.compile_typst_to_pdf", side_effect=fake_compile
        ):
            result = export_markdown_pdf(markdown, title="批量结果", source_type="extract_result")

        assert result == b"%PDF-test"
        assert captured["bin"] == "/fake/typst"
        assert '#text("商务标得分*90%")' in captured["source"]

    @pytest.mark.parametrize(
        ("markdown", "status_code"),
        [("  ", 400), ("x" * (MAX_MARKDOWN_BYTES + 1), 413)],
    )
    def test_export_rejects_invalid_content(self, markdown, status_code):
        with pytest.raises(HTTPException) as exc_info:
            export_markdown_pdf(markdown)

        assert exc_info.value.status_code == status_code

    def test_export_requires_typst(self):
        with patch("app.services.pdf_export_service.shutil.which", return_value=None):
            with pytest.raises(HTTPException) as exc_info:
                export_markdown_pdf("有效内容")

        assert exc_info.value.status_code == 500
        assert "Typst" in exc_info.value.detail

    def test_compile_reports_timeout(self):
        with patch("app.services.pdf_export_service.subprocess.run", side_effect=subprocess.TimeoutExpired("typst", 60)):
            with pytest.raises(HTTPException) as exc_info:
                compile_typst_to_pdf("/fake/typst", "#text(\"内容\")")

        assert exc_info.value.status_code == 500
        assert "超时" in exc_info.value.detail
