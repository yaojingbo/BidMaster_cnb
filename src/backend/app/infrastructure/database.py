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

    async def _create_pool(self) -> asyncpg.Pool:
        kwargs: dict = {"min_size": 0, "max_size": 10, "max_inactive_connection_lifetime": 120}
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
