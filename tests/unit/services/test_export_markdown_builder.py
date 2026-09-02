"""历史结果 Markdown 构造测试。"""

from app.services.export_markdown_builder import build_extract_markdown


class TestBuildExtractMarkdown:
    def test_existing_content_is_kept_for_shared_pdf_renderer(self):
        content = "## 总分计算\n\n商务标得分*90%+资信标得分，**重点**。"

        markdown, title = build_extract_markdown({"id": "batch-1", "name": "批量对比", "content": content})

        assert markdown == content
        assert title == "批量对比"

    def test_elements_are_used_when_content_is_empty(self):
        markdown, title = build_extract_markdown(
            {
                "id": "batch-2",
                "file_name": "两个项目对比.pdf",
                "content": "",
                "elements": [
                    {"name": "控制价", "content": "计算公式为A*（1-8%）"},
                    {"name": "空要素", "content": ""},
                ],
            }
        )

        assert title == "两个项目对比.pdf"
        assert markdown == "# 两个项目对比.pdf\n\n## 控制价\n\n计算公式为A*（1-8%）"
