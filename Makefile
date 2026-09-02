.PHONY: dev frontend backend rag-service stop restart install-cli test-backend-rag test-backend-rag-postgres test-frontend-unit type-check lint build test-rag test-all rag-check-env rag-real-test test-knowledge-e2e test-rag-service test-rag-smoke rag-health branch publish

BACKEND_VENV := .venv

FRONTEND_PORT ?= 3000
BACKEND_PORT ?= 8000
RAG_PORT ?= 8100
FRONTEND_LOG ?= .frontend.log
BACKEND_LOG ?= .backend.log
RAG_LOG ?= .rag-service.log

stop:
	-lsof -ti:$(FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	-lsof -ti:$(BACKEND_PORT) | xargs kill -9 2>/dev/null || true
	-lsof -ti:$(RAG_PORT) | xargs kill -9 2>/dev/null || true

frontend:
	npm run dev

backend:
	$(BACKEND_VENV)/bin/python -m uvicorn app.main:app --app-dir src/backend --reload --reload-dir src/backend/app --port $(BACKEND_PORT)

rag-service:
	@test -n "$(RAG_INTERNAL_TOKEN)" || (echo "缺少 RAG_INTERNAL_TOKEN，独立 RAG 服务未启动"; exit 1)
	RAG_INTERNAL_TOKEN="$(RAG_INTERNAL_TOKEN)" npm run dev --prefix src/rag-service

dev:
	$(MAKE) stop
	nohup npm run dev > $(FRONTEND_LOG) 2>&1 &
	nohup $(BACKEND_VENV)/bin/python -m uvicorn app.main:app --app-dir src/backend --reload --reload-dir src/backend/app --port $(BACKEND_PORT) > $(BACKEND_LOG) 2>&1 &
	@if [ -n "$(RAG_INTERNAL_TOKEN)" ]; then \
		nohup env RAG_INTERNAL_TOKEN="$(RAG_INTERNAL_TOKEN)" npm run dev --prefix src/rag-service > $(RAG_LOG) 2>&1 & \
	else \
		printf '%s\n' '缺少 RAG_INTERNAL_TOKEN，已启动 Next.js 与 FastAPI，跳过独立 RAG 服务' > $(RAG_LOG); \
	fi

restart:
	$(MAKE) dev

install-cli:
	bash install.sh

test-backend-rag:
	PYTHONPATH=src/backend $(BACKEND_VENV)/bin/python -m pytest --import-mode=importlib src/backend/tests/unit/services/test_rag_chunker.py src/backend/tests/unit/services/test_rag_answer_service.py src/backend/tests/unit/services/test_rag_index_service.py src/backend/tests/unit/services/test_embedding_service.py src/backend/tests/unit/services/test_archive_service.py src/backend/tests/unit/infrastructure/test_rag_schema.py -q

# 需要 RAG_TEST_DATABASE_URL 指向允许创建测试数据的真实 PostgreSQL。
test-backend-rag-postgres:
	PYTHONPATH=src/backend $(BACKEND_VENV)/bin/python -m pytest --import-mode=importlib src/backend/tests/integration/infrastructure/test_rag_repository_postgres.py -q

test-frontend-unit:
	npm run test:unit

type-check:
	npm run type-check

lint:
	npx eslint src/app src/frontend --max-warnings=10

build:
	npm run build

test-knowledge-e2e:
	npm run test:e2e -- e2e/knowledge.spec.ts

test-rag-service:
	npm test --prefix src/rag-service

test-rag-smoke: test-rag-service test-backend-rag
	PYTHONPATH=src/backend $(BACKEND_VENV)/bin/python -m pytest --import-mode=importlib src/backend/tests/integration/services/test_rag_deterministic_pipeline.py -q

rag-health:
	curl -fsS http://127.0.0.1:$(RAG_PORT)/internal/v1/health/live
	curl -fsS http://127.0.0.1:$(RAG_PORT)/internal/v1/health/ready

test-rag: test-rag-smoke test-frontend-unit type-check

test-all:
	PYTHONPATH=src/backend $(BACKEND_VENV)/bin/python -m pytest --import-mode=importlib src/backend/tests tests -q
	npm run test:unit
	npm run type-check
	npx eslint src/app src/frontend --max-warnings=10
	npm run build

rag-check-env:
	@PYTHONPATH=src/backend $(BACKEND_VENV)/bin/python -c "from app.config import get_settings; s=get_settings(); checks={'DATABASE_URL':bool(s.database_url),'DASHSCOPE_API_KEY':bool(s.dashscope_api_key),'DASHSCOPE_EMBEDDING_BASE_URL':bool(s.dashscope_embedding_base_url and '.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' in s.dashscope_embedding_base_url),'RAG_EMBEDDING_MODEL':s.rag_embedding_model=='text-embedding-v4','RAG_EMBEDDING_DIMENSION':s.rag_embedding_dimension==1024,'RAG_EMBEDDING_BATCH_SIZE':1<=s.rag_embedding_batch_size<=10,'RAG_EMBEDDING_BATCH_MAX_TOKENS':1<=s.rag_embedding_batch_max_tokens<=8192}; failed=[key for key,ok in checks.items() if not ok]; print('环境满足真实 RAG 验证' if not failed else '配置缺失或不合法: '+', '.join(failed)); raise SystemExit(1 if failed else 0)"

rag-real-test: rag-check-env
	@echo "请在已安装 vector、pg_trgm 的 PostgreSQL 环境执行真实 PDF 索引和问答验收。"


# ---- 分支与发布（仅封装 git，不重造轮子）----
branch:  ## 从最新 main 切功能分支，用法: make branch n=feat-xxx
	@test -n "$(n)" || (echo "用法: make branch n=feat-xxx"; exit 1)
	git checkout main && git pull --ff-only cnb main
	git checkout -b "$(n)"

publish:  ## 提交并推送当前分支（main 上拒绝直推）
	@[ "$$(git branch --show-current)" != "main" ] || (echo "禁止在 main 直接提交，先 make branch n=xxx"; exit 1)
	@git status --short
	@read -p "提交说明: " msg; git commit -m "$$msg" && git push -u cnb HEAD
