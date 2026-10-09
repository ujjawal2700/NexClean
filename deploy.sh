#!/usr/bin/env bash
# Redeploys NexClean on the VPS: pulls latest code, rebuilds both apps,
# restarts the backend PM2 cluster with a fresh .env, reloads nginx.
# Run from anywhere inside the repo: ./deploy.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("NexClean requires Node.js 22 or newer, including the PM2 runtime."); process.exit(1); }'

echo "==> Pulling latest code"
git pull origin main

echo "==> Building backend"
cd "$REPO_DIR/backend"
npm ci
npm run build

echo "==> Building frontend"
cd "$REPO_DIR/frontend"
npm ci
npm run build
# Guard against a stricter default umask regenerating dist/ as
# non-world-readable, which nginx (running as www-data) needs.
chmod -R o+rX "$REPO_DIR/frontend/dist"

echo "==> Restarting backend (all cluster workers, fresh env)"
pm2 restart nexclean-api --update-env

echo "==> Reloading nginx"
sudo systemctl reload nginx

echo "==> Deploy complete"
pm2 status
