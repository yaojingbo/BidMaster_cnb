from app.services.rag_chunker import RagChunker


def test_chunker_preserves_page_and_section():
    text = """--- 第 3 页文本 ---
第三章 投标人资格要求

投标人须具备建筑工程施工总承包一级资质，并提供有效证书。

--- 第 4 页表格 ---
| 项目 | 要求 |
| 保证金 | 10万元 |
"""
    chunks = RagChunker(chunk_size=120, overlap=20, min_chars=10).chunk(text)

    assert chunks
    assert chunks[0].page_start == 3
    assert "第三章" in (chunks[0].section_path or "")
    assert any(chunk.chunk_type == "table" and chunk.page_start == 4 for chunk in chunks)
    assert len({chunk.content_hash for chunk in chunks}) == len(chunks)


def test_chunker_rejects_invalid_overlap():
    try:
        RagChunker(chunk_size=100, overlap=100)
    except ValueError as exc:
        assert "必须小于" in str(exc)
    else:
        raise AssertionError("应拒绝不合法的 overlap")
