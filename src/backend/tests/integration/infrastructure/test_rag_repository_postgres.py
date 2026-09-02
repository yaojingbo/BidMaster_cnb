import os
import uuid

import pytest

from app.infrastructure.database import Database
from app.infrastructure.rag_repository import RagRepository


pytestmark = pytest.mark.asyncio


@pytest.fixture
async def rag_db():
    database_url = os.environ.get("RAG_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("需要 RAG_TEST_DATABASE_URL 指向真实 PostgreSQL 测试库")

    db = Database(database_url)
    await db.connect()
    suffix = uuid.uuid4().hex
    user_id = f"rag-user-{suffix}"
    kb_id = f"rag-kb-{suffix}"
    file_id = f"rag-file-{suffix}"
    await db.execute(
        """INSERT INTO users (id,username,email,password_hash,salt)
           VALUES ($1,$2,$3,'test','test')""",
        user_id, f"rag-{suffix}", f"rag-{suffix}@example.com",
    )
    await db.execute(
        "INSERT INTO knowledge_bases (id,user_id,name) VALUES ($1,$2,$3)",
        kb_id, user_id, f"RAG {suffix}",
    )
    await db.execute(
        """INSERT INTO files (id,original_name,path,size,type,user_id,file_hash)
           VALUES ($1,'test.pdf','test.pdf',1,'pdf',$2,$3)""",
        file_id, user_id, suffix,
    )
    try:
        yield db, user_id, kb_id, file_id
    finally:
        await db.execute("DELETE FROM users WHERE id=$1", user_id)
        await db.disconnect()


async def test_update_job_supports_processing_and_terminal_status(rag_db):
    db, user_id, kb_id, file_id = rag_db
    repository = RagRepository(db)
    job = await repository.create_job(kb_id, user_id, [file_id])

    await repository.update_job(job["id"], user_id, "processing", 0, 0)
    processing = await repository.get_job(job["id"], kb_id, user_id)
    assert processing is not None
    assert processing["status"] == "processing"
    assert float(processing["progress_percent"]) == 0

    await repository.update_job(job["id"], user_id, "failed", 0, 1, "测试失败")
    failed = await repository.get_job(job["id"], kb_id, user_id)
    assert failed is not None
    assert failed["status"] == "failed"
    assert float(failed["progress_percent"]) == 100
    assert failed["error_message"] == "测试失败"
    assert failed["finished_at"] is not None


async def test_failed_index_is_reset_for_retry(rag_db):
    db, user_id, _kb_id, file_id = rag_db
    repository = RagRepository(db)
    config = {
        "provider": "dashscope",
        "model": "text-embedding-v3",
        "dimension": 1024,
        "chunking_version": "v1",
        "index_version": "v1",
    }

    created = await repository.create_index(user_id, file_id, "source-hash", config)
    await repository.fail_index(created["id"], user_id, "FAILED", "首次失败")
    retried = await repository.create_index(user_id, file_id, "source-hash", config)

    assert retried["id"] == created["id"]
    assert retried["status"] == "pending"
    assert retried["error_code"] is None
    assert retried["error_message"] is None
    assert await repository.claim_index(retried["id"], user_id) is True
