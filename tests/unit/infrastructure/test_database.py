"""数据库连接池生命周期与并发恢复测试。"""
import asyncio

import asyncpg
import pytest

from app.infrastructure import database as database_module
from app.infrastructure.database import Database


class FakePool:
    def __init__(self, name: str, closing: bool = False):
        self.name = name
        self.closing = closing
        self.terminate_count = 0
        self.close_count = 0

    def is_closing(self) -> bool:
        return self.closing

    def terminate(self) -> None:
        self.terminate_count += 1
        self.closing = True

    async def close(self) -> None:
        self.close_count += 1
        self.closing = True


class PoolFactory:
    def __init__(self):
        self.created: list[FakePool] = []
        self.started = asyncio.Event()
        self.allowed = asyncio.Event()
        self.allowed.set()

    async def __call__(self) -> FakePool:
        self.started.set()
        await self.allowed.wait()
        pool = FakePool(f"pool-{len(self.created) + 1}")
        self.created.append(pool)
        return pool


def make_database() -> Database:
    return Database("postgresql://user:password@localhost/test")


@pytest.fixture(autouse=True)
def reset_global_database():
    original_db = database_module._db
    database_module._db = None
    yield
    database_module._db = original_db


class TestDatabasePoolLifecycle:
    @pytest.mark.asyncio
    async def test_concurrent_connect_creates_one_pool(self, monkeypatch):
        db = make_database()
        factory = PoolFactory()
        factory.allowed.clear()
        monkeypatch.setattr(db, "_create_pool", factory)

        tasks = [asyncio.create_task(db.connect()) for _ in range(20)]
        await factory.started.wait()
        assert len(factory.created) == 0
        factory.allowed.set()
        await asyncio.gather(*tasks)

        assert len(factory.created) == 1
        assert db.pool is factory.created[0]

    @pytest.mark.asyncio
    async def test_connect_replaces_closing_pool(self, monkeypatch):
        db = make_database()
        stale_pool = FakePool("stale", closing=True)
        factory = PoolFactory()
        db._pool = stale_pool
        monkeypatch.setattr(db, "_create_pool", factory)

        await db.connect()

        assert stale_pool.terminate_count == 1
        assert len(factory.created) == 1
        assert db.pool is factory.created[0]

    @pytest.mark.asyncio
    async def test_concurrent_failures_replace_only_failed_generation(self, monkeypatch):
        db = make_database()
        failed_pool = FakePool("failed")
        factory = PoolFactory()
        db._pool = failed_pool
        monkeypatch.setattr(db, "_create_pool", factory)

        arrived = 0
        both_arrived = asyncio.Event()

        async def operation(pool):
            nonlocal arrived
            if pool is failed_pool:
                arrived += 1
                if arrived == 2:
                    both_arrived.set()
                await both_arrived.wait()
                raise asyncpg.InterfaceError("connection is closed")
            return pool.name

        results = await asyncio.gather(db._retry(operation), db._retry(operation))

        replacement = factory.created[0]
        assert results == [replacement.name, replacement.name]
        assert len(factory.created) == 1
        assert failed_pool.terminate_count == 1
        assert replacement.terminate_count == 0
        assert db.pool is replacement

    @pytest.mark.asyncio
    async def test_late_reset_does_not_close_replacement(self, monkeypatch):
        db = make_database()
        failed_pool = FakePool("failed")
        replacement = FakePool("replacement")
        factory = PoolFactory()
        db._pool = replacement
        monkeypatch.setattr(db, "_create_pool", factory)

        await db._reset_pool(failed_pool)

        assert db.pool is replacement
        assert failed_pool.terminate_count == 0
        assert replacement.terminate_count == 0
        assert factory.created == []

    @pytest.mark.asyncio
    async def test_retry_connects_when_current_pool_is_already_closed(self, monkeypatch):
        db = make_database()
        closed_pool = FakePool("closed", closing=True)
        factory = PoolFactory()
        db._pool = closed_pool
        monkeypatch.setattr(db, "_create_pool", factory)

        async def operation(pool):
            return pool.name

        result = await db._retry(operation)

        assert result == "pool-1"
        assert closed_pool.terminate_count == 1
        assert db.pool is factory.created[0]

    @pytest.mark.asyncio
    async def test_retry_uses_replacement_pool_and_respects_limit(self, monkeypatch):
        db = make_database()
        first_pool = FakePool("first")
        factory = PoolFactory()
        db._pool = first_pool
        monkeypatch.setattr(db, "_create_pool", factory)
        calls: list[str] = []

        async def eventually_succeeds(pool):
            calls.append(pool.name)
            if len(calls) < 3:
                raise asyncpg.InterfaceError("closed")
            return pool.name

        result = await db._retry(eventually_succeeds)

        assert result == "pool-2"
        assert calls == ["first", "pool-1", "pool-2"]
        assert first_pool.terminate_count == 1
        assert factory.created[0].terminate_count == 1
        assert factory.created[1].terminate_count == 0

    @pytest.mark.asyncio
    async def test_non_connection_error_is_not_retried(self, monkeypatch):
        db = make_database()
        db._pool = FakePool("first")
        factory = PoolFactory()
        monkeypatch.setattr(db, "_create_pool", factory)
        calls = 0

        async def operation(pool):
            nonlocal calls
            calls += 1
            raise ValueError("业务错误")

        with pytest.raises(ValueError, match="业务错误"):
            await db._retry(operation)

        assert calls == 1
        assert factory.created == []

    @pytest.mark.asyncio
    async def test_disconnect_is_idempotent_and_prevents_reconnect(self, monkeypatch):
        db = make_database()
        pool = FakePool("active")
        factory = PoolFactory()
        db._pool = pool
        monkeypatch.setattr(db, "_create_pool", factory)

        await db.disconnect()
        await db.disconnect()

        assert pool.close_count == 1
        assert pool.terminate_count == 0
        assert db._pool is None
        with pytest.raises(RuntimeError, match="shut down"):
            await db.connect()
        await db._reset_pool(pool)
        assert factory.created == []


class TestGlobalDatabaseLifecycle:
    @pytest.mark.asyncio
    async def test_get_database_publishes_one_connected_instance(self, monkeypatch):
        connect_started = asyncio.Event()
        allow_connect = asyncio.Event()
        instances = []

        class FakeDatabase:
            def __init__(self):
                self.connected = False
                instances.append(self)

            async def connect(self):
                connect_started.set()
                await allow_connect.wait()
                self.connected = True

        monkeypatch.setattr(database_module, "Database", FakeDatabase)

        tasks = [asyncio.create_task(database_module.get_database()) for _ in range(10)]
        await connect_started.wait()
        assert database_module._db is None
        allow_connect.set()
        results = await asyncio.gather(*tasks)

        assert len(instances) == 1
        assert all(result is instances[0] for result in results)
        assert instances[0].connected is True

    @pytest.mark.asyncio
    async def test_get_database_can_retry_after_initialization_failure(self, monkeypatch):
        attempts = 0

        class FakeDatabase:
            def __init__(self):
                self.connected = False

            async def connect(self):
                nonlocal attempts
                attempts += 1
                if attempts == 1:
                    raise ConnectionError("首次连接失败")
                self.connected = True

        monkeypatch.setattr(database_module, "Database", FakeDatabase)

        with pytest.raises(ConnectionError, match="首次连接失败"):
            await database_module.get_database()
        assert database_module._db is None

        db = await database_module.get_database()
        assert db.connected is True
        assert attempts == 2

    @pytest.mark.asyncio
    async def test_close_database_disconnects_and_clears_global(self):
        class FakeDatabase:
            def __init__(self):
                self.disconnect_count = 0

            async def disconnect(self):
                self.disconnect_count += 1

        db = FakeDatabase()
        database_module._db = db

        await database_module.close_database()
        await database_module.close_database()

        assert db.disconnect_count == 1
        assert database_module._db is None
