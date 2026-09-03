from __future__ import annotations
"""
Database connection manager using asyncpg.
"""
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import asyncio
import ssl
import asyncpg

from app.config import get_settings


def _clean_dsn(dsn: str) -> tuple[str, bool]:
    """Remove asyncpg-incompatible params from DSN. Returns (cleaned_dsn, needs_ssl)."""
    parsed = urlparse(dsn)
    params = parse_qs(parsed.query, keep_blank_values=True)

    needs_ssl = False
    if "sslmode" in params:
        mode = params["sslmode"][0]
        if mode in ("require", "verify-ca", "verify-full"):
            needs_ssl = True
        del params["sslmode"]

    params.pop("channel_binding", None)

    flat = {k: v[0] for k, v in params.items()}
    new_query = urlencode(flat)
    cleaned = urlunparse(parsed._replace(query=new_query))
    return cleaned, needs_ssl


class Database:
    """asyncpg-based PostgreSQL connection manager."""

    def __init__(self, database_url: str | None = None):
        settings = get_settings()
        raw_url = database_url or settings.database_url
        self.database_url, self._needs_ssl = _clean_dsn(raw_url)
        self._pool: asyncpg.Pool | None = None
        self._connect_lock = asyncio.Lock()
        self._shutdown = False
        self._vector_codec_error: str | None = None

    @property
    def vector_codec_error(self) -> str | None:
        """pgvector 编解码器注册失败的原因；None 表示注册成功。"""
        return self._vector_codec_error

    async def _create_pool(self) -> asyncpg.Pool:
        kwargs: dict = {"min_size": 0, "max_size": 10, "max_inactive_connection_lifetime": 120}
        try:
            from pgvector.asyncpg import register_vector

            async def init_connection(conn: asyncpg.Connection) -> None:
                try:
                    await register_vector(conn)
                except Exception as exc:  # noqa: BLE001
                    # 这里不能只捕 UndefinedObjectError/UndefinedFunctionError：库中尚未安装 pgvector
                    # 扩展时 asyncpg 抛的是 ValueError("unknown type: public.vector")，且该异常类型跨版本
                    # 不稳定。扩展缺失属于可降级场景——核心业务仍需用这条连接，知识库能力检查
                    # （db_schema.init_schema）会在就绪状态里给出准确原因——但必须留下名字，不许静默。
                    first_failure = self._vector_codec_error is None
                    self._vector_codec_error = f"{type(exc).__name__}: {exc}"
                    if first_failure:
                        print(
                            f"WARN: pgvector 编解码器注册失败（{self._vector_codec_error}）；"
                            "核心业务继续启动，知识库/RAG 就绪检查将报告该原因"
                        )

            kwargs["init"] = init_connection
        except ImportError:
            # 依赖安装前保留现有业务可启动性；RAG 能力检查会返回明确错误。
            pass
        if self._needs_ssl:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            kwargs["ssl"] = ctx
        if "-pooler" in self.database_url:
            kwargs["statement_cache_size"] = 0
        return await asyncpg.create_pool(self.database_url, **kwargs)

    @staticmethod
    def _pool_is_usable(pool: asyncpg.Pool | None) -> bool:
        return pool is not None and not pool.is_closing()

    async def connect(self) -> None:
        if self._shutdown:
            raise RuntimeError("Database connection manager is shut down")
        if self._pool_is_usable(self._pool):
            return
        async with self._connect_lock:
            if self._shutdown:
                raise RuntimeError("Database connection manager is shut down")
            if self._pool_is_usable(self._pool):
                return
            stale_pool = self._pool
            self._pool = None
            if stale_pool is not None:
                stale_pool.terminate()
            self._pool = await self._create_pool()
            print("Database pool connected")

    async def register_vector_codec(self) -> None:
        """在 vector 扩展创建后为池内现有连接注册编解码器。"""
        from pgvector.asyncpg import register_vector

        async with self.pool.acquire() as conn:
            await register_vector(conn)

    async def disconnect(self) -> None:
        async with self._connect_lock:
            if self._shutdown:
                return
            self._shutdown = True
            pool = self._pool
            self._pool = None
        if pool is not None:
            await pool.close()

    @property
    def pool(self) -> asyncpg.Pool:
        if self._shutdown:
            raise RuntimeError("Database connection manager is shut down")
        if not self._pool_is_usable(self._pool):
            raise RuntimeError("Database not connected. Call await db.connect() first.")
        return self._pool

    async def _reset_pool(self, failed_pool: asyncpg.Pool) -> None:
        async with self._connect_lock:
            if self._shutdown:
                return
            if self._pool is not failed_pool:
                return
            self._pool = None
            failed_pool.terminate()
            self._pool = await self._create_pool()
            print("Database pool connected")

    async def _retry(self, fn, *args, retries=2):
        """执行数据库操作，连接断开时按失败池代际重连重试。"""
        for attempt in range(retries + 1):
            await self.connect()
            pool = self.pool
            try:
                return await fn(pool, *args)
            except (ConnectionError, asyncpg.PostgresConnectionError, asyncpg.InterfaceError, OSError):
                if attempt >= retries:
                    raise
                await self._reset_pool(pool)

    async def fetch_one(self, query: str, *args) -> dict | None:
        async def _do(pool: asyncpg.Pool):
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, *args)
                return dict(row) if row else None
        return await self._retry(_do)

    async def fetch_all(self, query: str, *args) -> list[dict]:
        async def _do(pool: asyncpg.Pool):
            async with pool.acquire() as conn:
                rows = await conn.fetch(query, *args)
                return [dict(r) for r in rows]
        return await self._retry(_do)

    async def execute(self, query: str, *args) -> str:
        async def _do(pool: asyncpg.Pool):
            async with pool.acquire() as conn:
                return await conn.execute(query, *args)
        return await self._retry(_do)


# Global instance (lazy, only created when needed)
_db: Database | None = None
_db_lock = asyncio.Lock()


async def get_database() -> Database:
    global _db
    async with _db_lock:
        if _db is None:
            candidate = Database()
            await candidate.connect()
            _db = candidate
        else:
            await _db.connect()
        return _db


async def close_database() -> None:
    global _db
    async with _db_lock:
        db = _db
        _db = None
        if db is not None:
            await db.disconnect()
