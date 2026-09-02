import asyncio

import pytest

from app.services.rag_index_service import RagIndexService, RagTaskRunner
from app.utils.exceptions import AppError


class FakeKnowledgeRepository:
    def __init__(self, files):
        self.files = files

    async def get(self, knowledge_base_id, user_id):
        return {"id": knowledge_base_id, "user_id": user_id}

    async def validate_member_files(self, knowledge_base_id, user_id, file_ids):
        return [item for item in self.files if item["id"] in file_ids]


class FakeRagRepository:
    def __init__(self, *, fail_items=False):
        self.fail_items = fail_items
        self.created_jobs = []
        self.deleted_jobs = []
        self.job_updates = []
        self.failed_items = []
        self.failed_jobs = []

    async def create_job(self, knowledge_base_id, user_id, file_ids):
        job = {"id": "job-1", "knowledge_base_id": knowledge_base_id, "user_id": user_id}
        self.created_jobs.append(job)
        return job

    async def delete_job(self, job_id, user_id):
        self.deleted_jobs.append((job_id, user_id))

    async def find_reusable_index(self, user_id, file_id, source_hash, config):
        return None

    async def create_index(self, user_id, file_id, source_hash, config, force):
        return {"id": f"index-{file_id}", "file_id": file_id, "status": "pending"}

    async def create_job_items(self, job, items):
        if self.fail_items:
            raise RuntimeError("明细写入失败")
        return items

    async def fail_job_from_items(self, job_id, user_id, message):
        self.failed_jobs.append((job_id, user_id, message))

    async def fail_unfinished_job_items(self, job_id, user_id, message):
        self.failed_items.append((job_id, user_id, message))

    async def update_job(self, job_id, user_id, status, completed, failed, error=None):
        self.job_updates.append((job_id, user_id, status, completed, failed, error))


class StubIndexService(RagIndexService):
    async def _ensure_file_source(self, file_id, user_id):
        return {"id": f"source-{file_id}"}


class FailingProcessService:
    def __init__(self, repository):
        self.rag_repository = repository

    async def process_job(self, job, items):
        raise RuntimeError("后台数据库异常")


@pytest.mark.asyncio
async def test_missing_hash_is_rejected_before_job_creation():
    repository = FakeRagRepository()
    service = StubIndexService(
        FakeKnowledgeRepository([{"id": "file-1", "type": "pdf", "original_name": "a.pdf", "file_hash": None}]),
        repository,
        embedding=object(),
    )

    with pytest.raises(AppError) as exc_info:
        await service.create_job("kb-1", "user-1", ["file-1"])

    assert exc_info.value.code == "FILE_HASH_MISSING"
    assert repository.created_jobs == []


@pytest.mark.asyncio
async def test_job_is_deleted_when_item_creation_fails():
    repository = FakeRagRepository(fail_items=True)
    service = StubIndexService(
        FakeKnowledgeRepository([{"id": "file-1", "type": "pdf", "original_name": "a.pdf", "file_hash": "hash"}]),
        repository,
        embedding=object(),
    )

    with pytest.raises(RuntimeError, match="明细写入失败"):
        await service.create_job("kb-1", "user-1", ["file-1"])

    assert repository.deleted_jobs == [("job-1", "user-1")]


@pytest.mark.asyncio
async def test_runner_persists_top_level_failure():
    repository = FakeRagRepository()
    runner = RagTaskRunner(FailingProcessService(repository))
    job = {"id": "job-1", "user_id": "user-1"}

    runner.submit(job, [{"file_id": "file-1"}])
    await asyncio.gather(*runner.tasks)

    assert repository.failed_jobs == [("job-1", "user-1", "后台数据库异常")]
    assert repository.failed_items == []
    assert repository.job_updates == []
