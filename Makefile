# ============================================
# Worker Log Viewer - Makefile
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
	@echo "$(CYAN)Worker Log Viewer - Available Commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Quick Start:$(RESET)"
	@echo "  1. make install    # Install dependencies"
	@echo "  2. make dev        # Start development server"
	@echo ""

# ============================================
# SETUP & INSTALLATION
# ============================================

.PHONY: install
install: ## Install dependencies
	@echo "$(CYAN)Installing dependencies...$(RESET)"
	@yarn install
	@echo "$(GREEN)✓ Dependencies installed$(RESET)"

.PHONY: clean
clean: ## Remove build artifacts
	@echo "$(CYAN)Cleaning build artifacts...$(RESET)"
ifeq ($(OS),Windows_NT)
	-@if exist build rmdir /s /q build
	-@if exist .cache rmdir /s /q .cache
	-@if exist .wrangler rmdir /s /q .wrangler
else
	@rm -rf build .cache .wrangler
endif
	@echo "$(GREEN)✓ Clean complete$(RESET)"

.PHONY: clean-all
clean-all: clean ## Remove build artifacts and node_modules
	@echo "$(CYAN)Removing node_modules...$(RESET)"
ifeq ($(OS),Windows_NT)
	-@if exist node_modules rmdir /s /q node_modules
else
	@rm -rf node_modules
endif
	@echo "$(GREEN)✓ Full clean complete$(RESET)"

# ============================================
# DEVELOPMENT
# ============================================

.PHONY: dev
dev: ## Start development server
	@echo "$(CYAN)Starting development server...$(RESET)"
	@echo "$(GREEN)→ Dashboard:$(RESET) http://localhost:5173"
	@echo ""
	@yarn dev

.PHONY: preview
preview: build ## Preview production build locally
	@echo "$(CYAN)Starting preview server...$(RESET)"
	@yarn preview

# ============================================
# BUILD & DEPLOY
# ============================================

.PHONY: build
build: ## Build for production
	@echo "$(CYAN)Building for production...$(RESET)"
	@yarn build
	@echo "$(GREEN)✓ Build complete$(RESET)"

.PHONY: deploy
deploy: ## Deploy to Cloudflare Pages
	@echo "$(RED)⚠️  WARNING: Deploying to PRODUCTION$(RESET)"
ifeq ($(OS),Windows_NT)
	@echo "$(YELLOW)⚠ Proceeding with deployment...$(RESET)"
else
	@echo -n "Are you sure? [yes/N]: " && read ans && [ $${ans:-N} = yes ]
endif
	@echo "$(CYAN)Deploying to Cloudflare Pages...$(RESET)"
	@yarn deploy
	@echo "$(GREEN)✓ Deployment complete$(RESET)"

# ============================================
# TESTING & QUALITY
# ============================================

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	@echo "$(CYAN)Running type checks...$(RESET)"
	@yarn typecheck
	@echo "$(GREEN)✓ Type checks passed$(RESET)"

.PHONY: check
check: typecheck ## Alias for typecheck

# ============================================
# PROJECT INFO
# ============================================

.PHONY: info
info: ## Show project information
	@echo "$(CYAN)Worker Log Viewer$(RESET)"
	@echo ""
	@echo "Simple R2-based log viewer for Cloudflare Workers"
	@echo ""
	@echo "Structure:"
	@echo "  app/                - Remix application"
	@echo "  functions/          - Cloudflare Pages Functions"
	@echo "  public/             - Static assets"
	@echo ""
	@echo "Documentation:"
	@echo "  README.md           - Project overview"
	@echo "  SETUP.md            - Setup guide"
	@echo ""
	@echo "Development URLs:"
	@echo "  Dashboard:          http://localhost:5173"
	@echo ""
