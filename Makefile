# ============================================
# Project Monitoring Platform - Makefile
# ============================================

.DEFAULT_GOAL := help

# Detect OS for color support
ifeq ($(OS),Windows_NT)
	CYAN :=
	GREEN :=
	YELLOW :=
	RED :=
	RESET :=
else
	CYAN := \033[0;36m
	GREEN := \033[0;32m
	YELLOW := \033[0;33m
	RED := \033[0;31m
	RESET := \033[0m
endif

# ============================================
# HELP
# ============================================

.PHONY: help
help: ## Show this help message
	@echo "$(CYAN)Project Monitoring Platform - Available Commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Quick Start:$(RESET)"
	@echo "  1. make setup          # Initial setup"
	@echo "  2. make cf-create-all  # Create Cloudflare resources"
	@echo "  3. make db-migrate     # Run database migrations"
	@echo "  4. make dev            # Start development servers"
	@echo ""

# ============================================
# SETUP & INSTALLATION
# ============================================

.PHONY: setup
setup: install env ## Initial setup (install deps + create .dev.vars)
	@echo "$(GREEN)✓ Setup complete!$(RESET)"
	@echo "$(YELLOW)Next steps:$(RESET)"
	@echo "  1. Run 'make cf-create-all' to create Cloudflare resources"
	@echo "  2. Update workers/api/wrangler.toml with resource IDs"
	@echo "  3. Run 'make db-migrate' to set up the database"
	@echo "  4. Run 'make dev' to start development servers"

.PHONY: install
install: ## Install all dependencies
	@echo "$(CYAN)Installing dependencies...$(RESET)"
	@yarn install
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

.PHONY: env
env: ## Create .dev.vars from example
	@echo "$(CYAN)Creating .dev.vars file...$(RESET)"
	@if [ ! -f workers/api/.dev.vars ]; then \
		cp workers/api/.dev.vars.example workers/api/.dev.vars; \
		echo "$(GREEN)✓ Created workers/api/.dev.vars$(RESET)"; \
		echo "$(YELLOW)→ Edit workers/api/.dev.vars with your credentials$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ .dev.vars already exists$(RESET)"; \
	fi

.PHONY: clean
clean: ## Remove build artifacts
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
ifeq ($(OS),Windows_NT)
	-@if exist workers\api\.wrangler rmdir /s /q workers\api\.wrangler
	-@if exist dashboard\build rmdir /s /q dashboard\build
	-@if exist dashboard\.cache rmdir /s /q dashboard\.cache
	-@if exist widget\build rmdir /s /q widget\build
	-@if exist packages\shared\dist rmdir /s /q packages\shared\dist
else
	@rm -rf workers/api/.wrangler dashboard/build dashboard/.cache widget/build packages/shared/dist
endif
	@echo "$(GREEN)✓ Clean complete$(RESET)"

.PHONY: clean-all
clean-all: clean ## Remove build artifacts and node_modules
	@echo "$(CYAN)Removing node_modules...$(RESET)"
ifeq ($(OS),Windows_NT)
	-@if exist node_modules rmdir /s /q node_modules
	-@if exist workers\api\node_modules rmdir /s /q workers\api\node_modules
	-@if exist dashboard\node_modules rmdir /s /q dashboard\node_modules
	-@if exist widget\node_modules rmdir /s /q widget\node_modules
	-@if exist packages\shared\node_modules rmdir /s /q packages\shared\node_modules
else
	@rm -rf node_modules workers/api/node_modules dashboard/node_modules widget/node_modules packages/shared/node_modules
endif
	@echo "$(GREEN)✓ Full clean complete$(RESET)"

.PHONY: reinstall
reinstall: ## Fix dependency issues (removes lock file and reinstalls)
	@echo "$(YELLOW)⚠️  This will remove yarn.lock and node_modules$(RESET)"
ifeq ($(OS),Windows_NT)
	@echo "$(YELLOW)⚠ Proceeding with reinstall...$(RESET)"
else
	@echo -n "Continue? [yes/N]: " && read ans && [ $${ans:-N} = yes ]
endif
	@echo "$(CYAN)Removing yarn.lock and node_modules...$(RESET)"
ifeq ($(OS),Windows_NT)
	-@if exist yarn.lock del /f yarn.lock
	-@if exist node_modules rmdir /s /q node_modules
	-@if exist workers\api\node_modules rmdir /s /q workers\api\node_modules
	-@if exist dashboard\node_modules rmdir /s /q dashboard\node_modules
	-@if exist widget\node_modules rmdir /s /q widget\node_modules
	-@if exist packages\shared\node_modules rmdir /s /q packages\shared\node_modules
else
	@rm -rf yarn.lock node_modules workers/api/node_modules dashboard/node_modules widget/node_modules packages/shared/node_modules
endif
	@echo "$(CYAN)Reinstalling dependencies...$(RESET)"
	@yarn install
	@echo "$(GREEN)✓ Dependencies reinstalled$(RESET)"

# ============================================
# DEVELOPMENT
# ============================================

.PHONY: dev
dev: ## Start API Worker + Dashboard concurrently
	@echo "$(CYAN)Starting development servers...$(RESET)"
	@echo "$(GREEN)→ API Worker:$(RESET)   http://localhost:8787"
	@echo "$(GREEN)→ Dashboard:$(RESET)    http://localhost:5173"
	@echo ""
	@npx concurrently -n "API,DASH" -c "cyan,magenta" \
		"yarn dev:api" \
		"yarn dev:dashboard"

.PHONY: dev-api
dev-api: ## Start only API Worker
	@echo "$(CYAN)Starting API Worker...$(RESET)"
	@echo "$(GREEN)→ Running on:$(RESET) http://localhost:8787"
	@yarn dev:api

.PHONY: dev-dashboard
dev-dashboard: ## Start only Dashboard
	@echo "$(CYAN)Starting Dashboard...$(RESET)"
	@echo "$(GREEN)→ Running on:$(RESET) http://localhost:5173"
	@yarn dev:dashboard

.PHONY: dev-widget
dev-widget: ## Build widget in watch mode
	@echo "$(CYAN)Building widget in watch mode...$(RESET)"
	@yarn dev:widget

# ============================================
# DATABASE (Drizzle + D1)
# ============================================

.PHONY: db-generate
db-generate: ## Generate Drizzle migrations from schema
	@echo "$(CYAN)Generating database migrations...$(RESET)"
	yarn db:generate
	@echo "$(GREEN)✓ Migrations generated in workers/api/drizzle/migrations$(RESET)"

.PHONY: db-migrate
db-migrate: ## Apply Drizzle migrations to D1 database
	@echo "$(CYAN)Applying migrations to D1...$(NC)"
	yarn db:migrate
	@echo "$(GREEN)Migrations applied$(NC)"

.PHONY: db-update
db-update: db-generate db-migrate ## Generate + apply migrations (recommended workflow)
	@echo "$(GREEN)✓ Database updated$(RESET)"

.PHONY: db-studio
db-studio: ## Open Drizzle Studio for visual DB exploration
	@echo "$(CYAN)Opening Drizzle Studio...$(RESET)"
	@echo "$(GREEN)→ Running on:$(RESET) https://local.drizzle.studio"
	@cd workers/api && yarn drizzle-kit studio

# ============================================
# BUILD & DEPLOY
# ============================================

.PHONY: build
build: ## Build all packages
	@echo "$(CYAN)Building all packages...$(RESET)"
	@yarn build
	@echo "$(GREEN)✓ Build complete$(RESET)"

.PHONY: deploy-api
deploy-api: ## Deploy API Worker to production
	@echo "$(CYAN)Deploying API Worker...$(RESET)"
	@yarn deploy:api
	@echo "$(GREEN)✓ API Worker deployed$(RESET)"
	@echo "$(YELLOW)→ Update dashboard/wrangler.toml and dashboard/app/lib/api.ts with Worker URL$(RESET)"

.PHONY: deploy-dashboard
deploy-dashboard: ## Deploy Dashboard to Cloudflare Pages
	@echo "$(CYAN)Deploying Dashboard...$(RESET)"
	@yarn deploy:dashboard
	@echo "$(GREEN)✓ Dashboard deployed$(RESET)"

.PHONY: deploy
deploy: deploy-api ## Deploy API Worker (alias)

.PHONY: deploy-prod
deploy-prod: ## Deploy to production with confirmation
	@echo "$(RED)⚠️  WARNING: Deploying to PRODUCTION$(RESET)"
ifeq ($(OS),Windows_NT)
	@echo "$(YELLOW)⚠ Proceeding with production deployment...$(RESET)"
else
	@echo -n "Are you sure? [yes/N]: " && read ans && [ $${ans:-N} = yes ]
endif
	@$(MAKE) deploy-api
	@$(MAKE) deploy-dashboard
	@echo "$(GREEN)✓ Production deployment complete$(RESET)"

.PHONY: build-widget
build-widget: ## Build widget for production
	@echo "$(CYAN)Building widget...$(RESET)"
	@cd widget && yarn build
	@echo "$(GREEN)✓ Widget built to widget/build/widget.js$(RESET)"
	@echo "$(YELLOW)→ Upload widget.js to your CDN or Cloudflare Pages$(RESET)"

# ============================================
# CLOUDFLARE RESOURCES
# ============================================

.PHONY: cf-login
cf-login: ## Authenticate with Wrangler
	@echo "$(CYAN)Logging in to Cloudflare...$(RESET)"
	@yarn wrangler login
	@echo "$(GREEN)✓ Authenticated$(RESET)"

.PHONY: cf-whoami
cf-whoami: ## Check Wrangler auth status
	@yarn wrangler whoami

.PHONY: cf-create-db
cf-create-db: ## Create D1 database
	@echo "$(CYAN)Creating D1 database...$(RESET)"
	@yarn wrangler d1 create project-monitoring
	@echo "$(GREEN)✓ Database created$(RESET)"
	@echo "$(YELLOW)→ Copy the database_id and update workers/api/wrangler.toml$(RESET)"

.PHONY: cf-create-kv
cf-create-kv: ## Create KV namespace for rate limiting
	@echo "$(CYAN)Creating KV namespace...$(RESET)"
	@yarn wrangler kv:namespace create project-monitoring-rate-limit-kv
	@echo "$(GREEN)✓ KV namespace created$(RESET)"
	@echo "$(YELLOW)→ Copy the id and update workers/api/wrangler.toml$(RESET)"

.PHONY: cf-create-all
cf-create-all: cf-create-db cf-create-kv ## Create all Cloudflare resources
	@echo "$(GREEN)✓ All resources created$(RESET)"
	@echo "$(YELLOW)→ Don't forget to update workers/api/wrangler.toml with the IDs!$(RESET)"

.PHONY: cf-ids
cf-ids: ## Print Cloudflare resource IDs from wrangler.toml
	@echo "$(CYAN)Cloudflare Resource IDs:$(RESET)"
	@echo ""
	@grep -A 2 "d1_databases" workers/api/wrangler.toml || echo "$(YELLOW)No D1 database configured$(RESET)"
	@echo ""
	@grep -A 2 "kv_namespaces" workers/api/wrangler.toml || echo "$(YELLOW)No KV namespace configured$(RESET)"

.PHONY: cf-secrets
cf-secrets: ## Set production secrets (admin credentials)
	@echo "$(CYAN)Setting production secrets...$(RESET)"
	@echo "Enter admin username:"
	@cd workers/api && yarn wrangler secret put ADMIN_USERNAME
	@echo "Enter admin password:"
	@cd workers/api && yarn wrangler secret put ADMIN_PASSWORD
	@echo "$(GREEN)✓ Secrets set$(RESET)"

# ============================================
# TESTING & QUALITY
# ============================================

.PHONY: check
check: ## Run type-check across all packages
	@echo "$(CYAN)Running type checks...$(RESET)"
	@cd workers/api && yarn tsc --noEmit
	@cd dashboard && yarn tsc --noEmit
	@cd widget && yarn tsc --noEmit
	@cd packages/shared && yarn tsc --noEmit
	@echo "$(GREEN)✓ Type checks passed$(RESET)"

# ============================================
# PROJECT INFO
# ============================================

.PHONY: info
info: ## Show project information
	@echo "$(CYAN)Project Monitoring Platform$(RESET)"
	@echo ""
	@echo "Structure:"
	@echo "  workers/api/        - Cloudflare Worker API (Hono)"
	@echo "  dashboard/          - Remix admin dashboard"
	@echo "  widget/             - Embeddable feedback widget"
	@echo "  packages/shared/    - Shared TypeScript types"
	@echo ""
	@echo "Documentation:"
	@echo "  README.md           - Full documentation"
	@echo "  SETUP.md            - Detailed setup guide"
	@echo "  QUICKSTART.md       - 5-minute quick start"
	@echo ""
	@echo "Development URLs:"
	@echo "  API Worker:         http://localhost:8787"
	@echo "  Dashboard:          http://localhost:5173"
	@echo "  Drizzle Studio:     https://local.drizzle.studio"
	@echo ""
