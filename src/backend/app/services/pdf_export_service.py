from __future__ import annotations

import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterable

from fastapi import HTTPException

MAX_MARKDOWN_BYTES = 5 * 1024 * 1024
TYPST_TIMEOUT_SECONDS = 60


@dataclass
class MarkdownProfile:
    title: str
    doc_kind: str
    heading_count: int
    max_heading_depth: int
    table_count: int
    wide_table_count: int
    list_count: int
    code_block_count: int
    is_long_document: bool
    is_table_heavy: bool


def analyze_markdown(markdown: str, source_type: str | None = None, title: str | None = None) -> MarkdownProfile:
    lines = markdown.splitlines()
    headings: list[tuple[int, str]] = []
    table_count = 0
    wide_table_count = 0
    list_count = 0
    code_block_count = 0
    in_code_block = False

    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            if in_code_block:
                code_block_count += 1
            continue
        if in_code_block:
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading_match:
            headings.append((len(heading_match.group(1)), heading_match.group(2).strip()))
            continue

        if re.match(r"^\s*([-*+]|\d+[.)])\s+", line):
            list_count += 1

        if _is_table_separator(stripped) and index > 0:
            previous = lines[index - 1].strip()
            columns = _table_column_count(previous)
            if columns >= 2:
                table_count += 1
                if columns >= 4:
                    wide_table_count += 1

    detected_title = title or _first_heading(headings) or "导出文档"
    text = markdown[:8000]
    doc_kind = _detect_doc_kind(source_type, text, headings)
    heading_count = len(headings)
    max_heading_depth = max((level for level, _ in headings), default=1)
    non_empty_lines = sum(1 for line in lines if line.strip())

    return MarkdownProfile(
        title=detected_title,
        doc_kind=doc_kind,
        heading_count=heading_count,
        max_heading_depth=max_heading_depth,
        table_count=table_count,
        wide_table_count=wide_table_count,
        list_count=list_count,
        code_block_count=code_block_count,
        is_long_document=heading_count >= 8 or non_empty_lines >= 160,
        is_table_heavy=table_count >= 3 or wide_table_count >= 1,
    )


def export_markdown_pdf(markdown: str, title: str | None = None, source_type: str | None = None) -> bytes:
    normalized = markdown.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="导出内容不能为空")
    if len(normalized.encode("utf-8")) > MAX_MARKDOWN_BYTES:
        raise HTTPException(status_code=413, detail="导出内容过大，请拆分后再导出")

    typst = shutil.which("typst")
    if not typst:
        raise HTTPException(status_code=500, detail="PDF 导出依赖 Typst，请先安装 typst")

    profile = analyze_markdown(normalized, source_type=source_type, title=title)
    typst_source = render_typst(normalized, profile)
    return compile_typst_to_pdf(typst, typst_source)


def render_typst(markdown: str, profile: MarkdownProfile) -> str:
    body = _markdown_to_typst(markdown, profile)
    accent = _accent_color(profile.doc_kind)
    font_size = "9pt" if profile.is_table_heavy else "10pt"
    heading_style = _heading_style(profile.doc_kind)
    toc = "#outline(title: \"目录\")\n#pagebreak()\n\n" if profile.is_long_document else ""
    return f"""#set document(title: {_typst_string(profile.title)})
#set page(
  paper: \"a4\",
  margin: (x: 1.8cm, y: 1.9cm),
  header: align(right, text(size: 8pt, fill: rgb(\"666666\"))[{_typst_text(profile.title)}]),
  footer: context align(center, text(size: 8pt, fill: rgb(\"666666\"))[#counter(page).display()])
)
#set text(font: (\"Noto Sans CJK SC\", \"Songti SC\", \"Arial Unicode MS\"), size: {font_size}, lang: \"zh\")
#set par(justify: true, leading: 0.72em)
#set heading(numbering: \"1.1\")
#show heading.where(level: 1): it => block(above: 1.2em, below: 0.8em)[
  #text(size: 17pt, weight: \"bold\", fill: rgb(\"{accent}\"))[#it.body]
  #line(length: 100%, stroke: 0.8pt + rgb(\"{accent}\"))
]
#show heading.where(level: 2): it => block(above: 1em, below: 0.45em)[
  #box(fill: rgb(\"{accent}\").lighten(88%), inset: (x: 0.55em, y: 0.34em), radius: 3pt)[
    #text(weight: \"bold\", fill: rgb(\"{accent}\"))[#it.body]
  ]
]
#show table: set text(size: {"8pt" if profile.is_table_heavy else "9pt"})
#show raw: set text(font: \"Menlo\", size: 8pt)

#align(center)[
  #text(size: 22pt, weight: \"bold\", fill: rgb(\"{accent}\"))[{_typst_text(profile.title)}]
]
#v(0.5em)
#align(center)[#text(size: 9pt, fill: rgb(\"666666\"))[{heading_style}]]
#v(1em)

{toc}{body}
"""


def compile_typst_to_pdf(typst_bin: str, typst_source: str) -> bytes:
    with TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / "document.typ"
        output_path = Path(temp_dir) / "document.pdf"
        input_path.write_text(typst_source, encoding="utf-8")
        try:
            subprocess.run(
                [typst_bin, "compile", str(input_path), str(output_path)],
                check=True,
                capture_output=True,
                text=True,
                timeout=TYPST_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(status_code=500, detail="PDF 编译超时，请减少内容后重试") from exc
        except subprocess.CalledProcessError as exc:
            detail = exc.stderr.strip() or exc.stdout.strip() or "Typst 编译失败"
            raise HTTPException(status_code=500, detail=detail[:1000]) from exc
        return output_path.read_bytes()


def _markdown_to_typst(markdown: str, profile: MarkdownProfile) -> str:
    blocks: list[str] = []
    lines = markdown.splitlines()
    index = 0
    paragraph: list[str] = []
    in_code_block = False
    code_lines: list[str] = []

    def flush_paragraph() -> None:
        if paragraph:
            blocks.append(_typst_text(" ".join(part.strip() for part in paragraph if part.strip())))
            paragraph.clear()

    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            if in_code_block:
                blocks.append("```\n" + "\n".join(code_lines) + "\n```")
                code_lines.clear()
                in_code_block = False
            else:
                in_code_block = True
            index += 1
            continue

        if in_code_block:
            code_lines.append(line)
            index += 1
            continue

        if not stripped:
            flush_paragraph()
            index += 1
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            content = heading.group(2).strip()
            blocks.append(f"{'=' * min(level, 3)} {_typst_text(content)}")
            index += 1
            continue

        if _is_table_start(lines, index):
            flush_paragraph()
            table_lines = [lines[index]]
            index += 2
            while index < len(lines) and "|" in lines[index].strip() and lines[index].strip():
                table_lines.append(lines[index])
                index += 1
            blocks.append(_table_to_typst(table_lines, compact=profile.is_table_heavy))
            continue

        if re.match(r"^\s*[-*+]\s+", line):
            flush_paragraph()
            blocks.append("- " + _typst_text(re.sub(r"^\s*[-*+]\s+", "", line).strip()))
            index += 1
            continue

        ordered = re.match(r"^\s*\d+[.)]\s+(.+)$", line)
        if ordered:
            flush_paragraph()
            blocks.append("+ " + _typst_text(ordered.group(1).strip()))
            index += 1
            continue

        if re.match(r"^[-*_]{3,}$", stripped):
            flush_paragraph()
            blocks.append("#line(length: 100%, stroke: 0.5pt + rgb(\"dddddd\"))")
            index += 1
            continue

        paragraph.append(line)
        index += 1

    flush_paragraph()
    return "\n\n".join(blocks)


def _table_to_typst(table_lines: list[str], compact: bool) -> str:
    rows = [_split_table_row(line) for line in table_lines]
    if not rows:
        return ""
    columns = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (columns - len(row)) for row in rows]
    cells: list[str] = []
    for row_index, row in enumerate(normalized_rows):
        for cell in row:
            text = _typst_text(cell.strip())
            if row_index == 0:
                cells.append(f"[*{text}*]")
            else:
                cells.append(f"[{text}]")
    inset = "3pt" if compact else "5pt"
    return "#table(\n  columns: " + str(columns) + ",\n  stroke: 0.35pt + rgb(\"dddddd\"),\n  inset: " + inset + ",\n  " + ",\n  ".join(cells) + "\n)"


def _split_table_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    return [cell.strip() for cell in stripped.split("|")]


def _is_table_start(lines: list[str], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    return "|" in lines[index] and _is_table_separator(lines[index + 1].strip())


def _is_table_separator(line: str) -> bool:
    return bool(re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$", line))


def _table_column_count(line: str) -> int:
    return len(_split_table_row(line)) if "|" in line else 0


def _first_heading(headings: Iterable[tuple[int, str]]) -> str | None:
    for _, title in headings:
        return title
    return None


def _detect_doc_kind(source_type: str | None, text: str, headings: list[tuple[int, str]]) -> str:
    if source_type:
        return source_type
    joined_headings = " ".join(title for _, title in headings)
    corpus = f"{joined_headings} {text}"
    if any(keyword in corpus for keyword in ["开标", "投标价排名", "报价排名", "离散系数"]):
        return "opening_analysis"
    if any(keyword in corpus for keyword in ["模拟编制", "Step 4", "投标人须知", "招标公告"]):
        return "simulate_document"
    if any(keyword in corpus for keyword in ["资质要求", "业绩要求", "人员要求", "评标办法", "评分细则", "合同条款"]):
        return "extract_result"
    if any(keyword in corpus for keyword in ["综合分析", "风险", "建议", "策略"]):
        return "comprehensive_analysis"
    return "general_report"


def _accent_color(doc_kind: str) -> str:
    if doc_kind in {"opening_analysis", "statistics"}:
        return "2563eb"
    if doc_kind in {"simulate_document", "simulate"}:
        return "7c3aed"
    if doc_kind in {"extract_result", "extract"}:
        return "0f766e"
    if doc_kind in {"comprehensive_analysis", "analysis"}:
        return "b45309"
    return "374151"


def _heading_style(doc_kind: str) -> str:
    labels = {
        "opening_analysis": "开标分析型报告 · 表格与指标优先排版",
        "simulate_document": "模拟编制型文档 · 章节化正式排版",
        "extract_result": "要素提取型报告 · 关键信息分组排版",
        "comprehensive_analysis": "综合分析型报告 · 阅读型排版",
    }
    return labels.get(doc_kind, "智能 Markdown PDF 导出")


def _typst_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _typst_text(value: str) -> str:
    escaped = (
        value.replace("\\", "\\\\")
        .replace("#", "\\#")
        .replace("$", "\\$")
        .replace("@", "\\@")
        .replace("<", "\\<")
        .replace(">", "\\>")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("%", "\\%")
        .replace("&", "\\&")
        .replace("_", "\\_")
    )
    return escaped
