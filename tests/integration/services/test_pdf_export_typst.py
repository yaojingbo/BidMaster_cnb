"""真实 Typst PDF 编译回归测试。"""
import shutil

import pytest

from app.services.pdf_export_service import export_markdown_pdf


@pytest.mark.integration
@pytest.mark.skipif(not shutil.which("typst"), reason="当前环境未安装 Typst")
def test_real_typst_compiles_tender_report_with_special_characters():
    markdown = """# 批量要素提取结果

- **控制价**：最高投标限价计算公式为（工程量清单编制造价-安全文明施工基本费）*（1-8%）。
- **总分计算**：投标人总得分=商务标得分*90%+资信标得分。
- **特殊字符**：\\ # $ @ < > [ ] _ `未闭合。

| 指标 | 公式 | 代码 |
| --- | --- | --- |
| 商务标 | 得分*90% | `A|B` |
| 条件 | A\\|B | **有效** |

````text
含有 ```、#raw、# $ [ ] *、引号 " 和反斜杠 \\ 的代码
````
"""

    pdf = export_markdown_pdf(markdown, title="批量要素提取结果", source_type="extract_result")

    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1000
