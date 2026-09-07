"""
游客模式演示数据种子。

为 guest-demo 预置一份只读样例数据，让未登录用户浏览各功能页时
能看到效果（数据库/提取/开标/模拟/项目查询/知识库等），而非空列表。

幂等：仅当游客名下无任何数据时才写入，重启不会重复插入。
写操作与 AI 调用仍由 get_current_user 按请求方法拦截，游客不可触发。
"""
import uuid

from app.infrastructure.pg_storage import (
    add_user,
    add_file,
    add_extract,
    add_opening,
    add_simulate,
    add_project_source,
    get_stats,
)

GUEST_USER_ID = "guest-demo"

# 不可登录的占位哈希：游客账号不提供真实密码，仅用于满足用户表约束
_GUEST_USER = {
    "id": GUEST_USER_ID,
    "username": "guest-demo",
    "email": "guest-demo@bidmaster.local",
    "password_hash": "guest-disabled-password",
    "salt": "guest-disabled-password",
    "role": "guest",
    "is_active": True,
}

# 演示文件（仅元数据，无真实文件内容），同时供知识库演示数据按名引用
_DEMO_FILE_NAMES = ("示例-市政道路施工招标文件.pdf", "示例-评标办法说明.md")

# 知识库演示数据常量
_KB_NAME = "示例知识库"
_KB_DESCRIPTION = "游客演示知识库：包含招投标文档样例，仅展示元数据与已索引状态，不提供真实检索问答。"
_KB_SOURCE_HASH = "guest-demo-seed"
_KB_CHUNK_COUNT = 12


async def seed_guest_demo_data() -> None:
    """确保游客用户存在，并在无数据时写入演示数据（幂等）。"""
    await add_user(_GUEST_USER.copy())

    stats = await get_stats(GUEST_USER_ID)
    if not any(stats.values()):
        await _seed_guest_files_and_results()

    # 知识库演示数据独立幂等：不依赖上面的 stats 守卫，
    # 即使文件/结果已预置、仅知识库缺失时也能补齐。
    await _seed_guest_knowledge_base()


async def _seed_guest_files_and_results() -> None:
    """预置文件 / 要素提取 / 开标分析 / 模拟编制 / 项目信息源演示数据。"""
    # 1. 样例文件（仅元数据，无真实文件内容）
    await add_file(
        {
            "original_name": _DEMO_FILE_NAMES[0],
            "path": "demo/示例-市政道路施工招标文件.pdf",
            "size": 2457600,
            "type": "application/pdf",
        },
        user_id=GUEST_USER_ID,
    )
    await add_file(
        {
            "original_name": _DEMO_FILE_NAMES[1],
            "path": "demo/示例-评标办法说明.md",
            "size": 8192,
            "type": "text/markdown",
        },
        user_id=GUEST_USER_ID,
    )

    # 2. 样例要素提取结果
    await add_extract(
        {
            "name": "要素提取_示例-市政道路施工招标文件",
            "file_name": _DEMO_FILE_NAMES[0],
            "template_type": "standard",
            "mode": "single",
            "status": "completed",
            "elements": [
                {
                    "name": "项目基本信息",
                    "content": "项目名称：XX 市市政道路新建工程；招标人：XX 市住房和城乡建设局；预算金额约 5800 万元；计划工期 365 日历天。",
                },
                {
                    "name": "资质要求",
                    "content": "投标人须具备市政公用工程施工总承包贰级及以上资质，并在人员、设备、资金等方面具备相应的施工能力。",
                },
                {
                    "name": "评标办法",
                    "content": "采用综合评估法：商务分 40 分、技术分 50 分、价格分 10 分；设置最高投标限价。",
                },
                {
                    "name": "合同条款",
                    "content": "缺陷责任期 24 个月；预付款比例为合同价的 10%；进度款按月支付。",
                },
            ],
        },
        user_id=GUEST_USER_ID,
    )

    # 3. 样例开标报价分析
    await add_opening(
        {
            "name": "开标分析_示例-市政道路施工招标文件",
            "file_name": _DEMO_FILE_NAMES[0],
            "status": "completed",
            "meta": {
                "project_name": "XX 市市政道路新建工程",
                "bid_number": "GC-2026-0315",
                "max_price": 5800.0,
                "benchmark_price": 5532.0,
                "d_value": 1.5,
            },
            "bidder_count": 5,
            "bid_ranking": [
                {"rank": 1, "name": "甲公司", "price": 5520.0, "deviation_pct": 1.2, "gap_from_lowest": 75.0},
                {"rank": 2, "name": "乙公司", "price": 5445.0, "deviation_pct": -0.2, "gap_from_lowest": 0.0},
                {"rank": 3, "name": "丙公司", "price": 5680.0, "deviation_pct": 4.1, "gap_from_lowest": 235.0},
                {"rank": 4, "name": "丁公司", "price": 5575.0, "deviation_pct": 2.2, "gap_from_lowest": 130.0},
                {"rank": 5, "name": "戊公司", "price": 5510.0, "deviation_pct": 1.0, "gap_from_lowest": 65.0},
            ],
            "bid_stats": {
                "max": 5680.0,
                "min": 5445.0,
                "mean": 5546.0,
                "std_dev": 90.5,
                "cv": 1.63,
                "cv_level": "低",
                "range": 235.0,
                "count": 5,
            },
            "ai_analysis": "示例分析：5 家投标单位报价离散系数 1.63%（低），报价分布合理；甲公司综合得分领先，建议重点关注价格分与商务分的平衡。",
        },
        user_id=GUEST_USER_ID,
    )

    # 4. 样例模拟编制任务
    await add_simulate(
        {
            "name": "模拟编制_示例-市政道路施工",
            "status": "completed",
            "current_step": 4,
            "params": {"template": "standard"},
            "step_results": {
                "step1": "已解析招标文件结构",
                "step2": "已生成投标文件大纲",
                "step3": "已填充商务标",
                "step4": "已生成技术标初稿",
            },
            "file_names": [_DEMO_FILE_NAMES[0]],
        },
        user_id=GUEST_USER_ID,
    )

    # 5. 样例项目信息源
    await add_project_source(
        {
            "name": "中国政府采购网",
            "url": "https://www.ccgp.gov.cn",
            "category": "government_procurement",
            "region": "全国",
            "tags": ["政府采购", "招标公告"],
            "note": "全国政府采购信息统一发布平台",
        },
        user_id=GUEST_USER_ID,
    )
    await add_project_source(
        {
            "name": "XX 市公共资源交易中心",
            "url": "https://ggzy.example.gov.cn",
            "category": "public_resource",
            "region": "XX 市",
            "tags": ["公共资源", "工程招标"],
            "note": "示例：地方公共资源交易平台",
        },
        user_id=GUEST_USER_ID,
    )


async def _seed_guest_knowledge_base() -> None:
    """预置「示例知识库 + 文档 + 已索引」元数据（幂等，不做真实检索/embedding）。

    仅写入 knowledge_bases / knowledge_base_files / rag_indexes 三张表，
    让知识库列表与详情对游客非空；问答因无真实向量数据而为空。
    index_config 从运行时配置读取，确保与 KnowledgeRepository.list/list_files
    的 LATERAL JOIN 过滤条件一致。
    """
    from app.config import get_settings
    from app.infrastructure.database import get_database

    settings = get_settings()
    db = await get_database()

    existing = await db.fetch_one(
        "SELECT id FROM knowledge_bases WHERE user_id = $1 AND name = $2",
        GUEST_USER_ID, _KB_NAME,
    )
    if existing:
        return

    file_rows = await db.fetch_all(
        """SELECT id FROM files
           WHERE user_id = $1 AND original_name = ANY($2::varchar[])
           ORDER BY created_at ASC""",
        GUEST_USER_ID,
        list(_DEMO_FILE_NAMES),
    )
    if not file_rows:
        return

    kb_id = str(uuid.uuid4())[:8]
    await db.execute(
        """INSERT INTO knowledge_bases (id, user_id, name, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING""",
        kb_id, GUEST_USER_ID, _KB_NAME, _KB_DESCRIPTION,
    )

    index_config = (
        settings.rag_embedding_provider,
        settings.rag_embedding_model,
        settings.rag_embedding_dimension,
        settings.rag_chunking_version,
        settings.rag_index_version,
    )
    for file_row in file_rows:
        await db.execute(
            """INSERT INTO knowledge_base_files (knowledge_base_id, file_id, user_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (knowledge_base_id, file_id) DO NOTHING""",
            kb_id, file_row["id"], GUEST_USER_ID,
        )
        await db.execute(
            """INSERT INTO rag_indexes
               (id, file_id, user_id, source_hash, embedding_provider, embedding_model,
                embedding_dimension, chunking_version, index_version, status, chunk_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'completed', $10)
               ON CONFLICT (file_id, user_id, source_hash, embedding_provider, embedding_model,
                            embedding_dimension, chunking_version, index_version)
               DO NOTHING""",
            str(uuid.uuid4())[:8], file_row["id"], GUEST_USER_ID,
            _KB_SOURCE_HASH, *index_config, _KB_CHUNK_COUNT,
        )
