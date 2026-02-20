#!/usr/bin/env bash
# =============================================================================
# VPS integration script — run this on your VPS to deploy or update the app.
# Usage:
#   ./scripts/integrate-vps.sh           # full: pull, install, migrate, build, restart
#   ./scripts/integrate-vps.sh --no-pull # skip git pull (e.g. you copied files)
#   ./scripts/integrate-vps.sh --no-restart # do not restart the process (e.g. no PM2)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

DO_PULL=true
DO_RESTART=true

for arg in "$@"; do
  case "$arg" in
    --no-pull)    DO_PULL=false ;;
    --no-restart) DO_RESTART=false ;;
    -h|--help)
      echo "Usage: $0 [--no-pull] [--no-restart]"
      echo "  --no-pull     Skip 'git pull' (use when not using git on VPS)"
      echo "  --no-restart  Skip restarting the app (e.g. when not using PM2)"
      exit 0
      ;;
  esac
done

echo "[integrate-vps] Project directory: $PROJECT_DIR"

# -----------------------------------------------------------------------------
# 1. Pull latest (optional)
# -----------------------------------------------------------------------------
if [ "$DO_PULL" = true ]; then
  if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "[integrate-vps] Pulling latest..."
    git pull
  else
    echo "[integrate-vps] Not a git repo, skipping pull."
  fi
fi

# -----------------------------------------------------------------------------
# 2. Install dependencies
# -----------------------------------------------------------------------------
echo "[integrate-vps] Installing dependencies..."
npm ci

# -----------------------------------------------------------------------------
# 3. Database: generate client + run migrations
# -----------------------------------------------------------------------------
if [ -n "$DATABASE_URL" ] || [ -f .env ]; then
  echo "[integrate-vps] Running Prisma generate and migrate..."
  npx prisma generate
  npx prisma migrate deploy
else
  echo "[integrate-vps] WARNING: DATABASE_URL not set and no .env — skipping Prisma."
fi

# -----------------------------------------------------------------------------
# 4. Build
# -----------------------------------------------------------------------------
echo "[integrate-vps] Building app..."
npm run build

# -----------------------------------------------------------------------------
# 5. Restart app (PM2 or systemd — adjust to your setup)
# -----------------------------------------------------------------------------
if [ "$DO_RESTART" = true ]; then
  if command -v pm2 > /dev/null 2>&1; then
    echo "[integrate-vps] Restarting app with PM2..."
    pm2 restart promo-nex-ai 2>/dev/null || pm2 start npm --name "promo-nex-ai" -- run start
  else
    echo "[integrate-vps] PM2 not found. Restart the app manually (e.g. systemd or 'npm run start')."
  fi
fi

echo "[integrate-vps] Done."
