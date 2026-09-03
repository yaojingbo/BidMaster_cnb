"""pgvector 编解码器注册的降级行为回归测试。

背景：建池回调若让 register_vector 的异常逃逸，get_database() 就会抛错，进而使 lifespan
启动失败 → 容器崩溃重启循环。而库中未安装 vector 扩展时 asyncpg 抛的是 ValueError
（"unknown type: public.vector"），不是 UndefinedObjectError —— 这正是 2026-09-03
生产后端崩溃循环的成因。本测试锁死「必须降级、且必须留下原因」两件事。
"""

from __future__ import annotations

import asyncpg
import pgvector.asyncpg as pgvector_asyncpg
import pytest

from app.infrastructure.database import Database


async def _make_pool_capturing_init(monkeypatch, register_side_effect):
    """拦住真实建池，只把 init 回调取出来单独执行。"""

    async def fake_register(conn):
        if isinstance(register_side_effect, Exception):
            raise register_side_effect

    captured: dict = {}

    async def fake_create_pool(dsn, **kwargs):
        captured.update(kwargs)
        raise AssertionError("测试不创建真实连接池")

    monkeypatch.setattr(pgvector_asyncpg, "register_vector", fake_register)
    monkeypatch.setattr(asyncpg, "create_pool", fake_create_pool)

    db = Database("postgresql://u:***@127.0.0.1:59999/unreachable")
    with pytest.raises(AssertionError):
        await db._create_pool()
    return db, captured["init"]


async def test_unknown_vector_type_does_not_escape_pool_init(monkeypatch):
    """扩展缺失时 asyncpg 抛 ValueError：回调必须吞掉它，并把原因记录下来。"""
    db, init = await _make_pool_capturing_init(monkeypatch, ValueError("unknown type: public.vector"))

    await init(object())  # 关键断言：不得抛出，否则容器起不来

    assert db.vector_codec_error == "ValueError: unknown type: public.vector"


async def test_undefined_object_error_still_degrades(monkeypatch):
    """原先显式捕获的两类 asyncpg 异常，行为保持不变。"""
    db, init = await _make_pool_capturing_init(monkeypatch, asyncpg.UndefinedObjectError("type does not exist"))

    await init(object())

    assert db.vector_codec_error == "UndefinedObjectError: type does not exist"


async def test_successful_registration_leaves_no_error(monkeypatch):
    db, init = await _make_pool_capturing_init(monkeypatch, None)

    await init(object())

    assert db.vector_codec_error is None
