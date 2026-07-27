from app.services.knowledge_service import chunk_text


def test_chunk_text_keeps_content_and_bounds_chunks():
    text = "第一段内容。" * 30 + "\n\n" + "第二段内容。" * 30
    chunks = chunk_text(text, size=120, overlap=20)

    assert len(chunks) > 1
    assert all(chunk.strip() for chunk in chunks)
    assert chunks[0].startswith("第一段")
    assert "第二段" in chunks[-1]


def test_chunk_text_empty_input():
    assert chunk_text("  \n\n ", size=100, overlap=10) == []


def test_chunk_text_preserves_overlap():
    chunks = chunk_text("甲" * 80 + "\n\n" + "乙" * 80, size=100, overlap=12)

    assert len(chunks) == 2
    assert chunks[1].startswith("甲" * 12)
