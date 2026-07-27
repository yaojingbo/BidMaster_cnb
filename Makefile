.PHONY: dev frontend backend stop restart install-cli

BACKEND_VENV := .venv

FRONTEND_PORT ?= 3000
BACKEND_PORT ?= 8000
FRONTEND_LOG ?= .frontend.log
BACKEND_LOG ?= .backend.log

stop:
	-lsof -ti:$(FRONTEND_PORT) | xargs kill -9 2>/dev/null || true
	-lsof -ti:$(BACKEND_PORT) | xargs kill -9 2>/dev/null || true

frontend:
	npm run dev

backend:
	. $(BACKEND_VENV)/bin/activate && uvicorn app.main:app --app-dir src/backend --reload --reload-dir src/backend/app --port $(BACKEND_PORT)

dev:
	$(MAKE) stop
	nohup npm run dev > $(FRONTEND_LOG) 2>&1 &
	nohup sh -c '. $(BACKEND_VENV)/bin/activate && uvicorn app.main:app --app-dir src/backend --reload --reload-dir src/backend/app --port $(BACKEND_PORT)' > $(BACKEND_LOG) 2>&1 &

restart:
	$(MAKE) dev

install-cli:
	bash install.sh
