"""根测试目录公共配置。"""
import os

# 旧 API 集成测试没有构造 JWT；测试环境统一启用受控的本地认证旁路。
os.environ.setdefault("AUTH_DISABLED", "true")
os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("KNOWLEDGE_BASE_ENABLED", "false")
