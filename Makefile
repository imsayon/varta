.PHONY: help up down logs shell migrate seed validate lint typecheck test build backup restore cleanup

ENV_FILE ?= ops/env/local.env
COMPOSE = docker compose --env-file $(ENV_FILE) -f ops/compose/compose.yaml

help:
	@echo "Varta Operational Commands:"
	@echo "  make up        - Start production compose services"
	@echo "  make down      - Stop production compose services"
	@echo "  make logs      - Stream container logs"
	@echo "  make shell     - Open shell in API container"
	@echo "  make migrate   - Run database migrations"
	@echo "  make seed      - Seed database"
	@echo "  make validate  - Run preflight environment validator"
	@echo "  make lint      - Run code linter"
	@echo "  make typecheck - Run TypeScript typecheck"
	@echo "  make test      - Run server test suite"
	@echo "  make build     - Build server and client"
	@echo "  make backup    - Dump compressed PostgreSQL backup"
	@echo "  make restore   - Restore database from backup file (FILE=path)"
	@echo "  make cleanup   - Clean dangling containers and volumes"

up: validate
	$(COMPOSE) up -d --build --remove-orphans

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=100

shell:
	$(COMPOSE) exec api sh

migrate:
	pnpm --dir server prisma:migrate

seed:
	pnpm --dir server prisma:seed

validate:
	./ops/scripts/validate.sh $(ENV_FILE)

lint:
	pnpm --dir client lint

typecheck:
	pnpm --dir server typecheck && pnpm --dir client typecheck

test:
	pnpm --dir server test

build:
	pnpm --dir server build && pnpm --dir client build

backup:
	./ops/scripts/backup.sh $(ENV_FILE)

restore:
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=ops/backups/varta_xxx.sql.gz"; exit 1; fi
	./ops/scripts/restore.sh $(FILE) $(ENV_FILE)

cleanup:
	./ops/scripts/cleanup.sh
