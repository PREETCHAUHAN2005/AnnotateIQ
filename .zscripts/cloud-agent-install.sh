#!/usr/bin/env bash
# Idempotent Cloud Agent install for AnnotateIQ (Next.js 16 + Prisma/SQLite).
# Installs bun, prepares a local .env, installs deps, and creates the SQLite DB.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Ensure bun is available (the repo pins bun via bun.lock and all scripts use it).
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  echo "[install] bun not found — installing..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
echo "[install] bun $(bun --version)"

# 2. Ensure a local .env exists for Prisma/Next.js.
#    - DATABASE_URL: local SQLite file (matches the repo's db/custom.db convention).
#    - SKIP_LLM=1: run the multi-agent pipeline with deterministic heuristic
#      fallbacks so it works fully offline. Remove this line once real
#      z-ai-web-dev-sdk credentials are configured.
mkdir -p "$REPO_ROOT/db"
if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "[install] creating .env"
  {
    printf 'DATABASE_URL="file:%s/db/custom.db"\n' "$REPO_ROOT"
    printf 'SKIP_LLM=1\n'
  } > "$REPO_ROOT/.env"
fi

# 3. Install JS dependencies (postinstall runs `prisma generate`).
echo "[install] bun install"
bun install

# 4. Create / sync the SQLite schema (idempotent).
echo "[install] prisma db push"
bun run db:push

echo "[install] done"
