#!/usr/bin/env bash
# Redeploys NexClean on the VPS: pulls latest code, rebuilds both apps,
# starts or reloads the backend PM2 cluster, then reloads nginx.
# Run from anywhere inside the repo: ./deploy.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

for required in node npm git pm2 sudo; do
  command -v "$required" >/dev/null 2>&1 || { echo "Missing required command: $required" >&2; exit 1; }
done

# PM2 state belongs to the Unix user (and PM2_HOME) running this script.
echo "==> Deploying as $(id -un); PM2_HOME=${PM2_HOME:-${HOME}/.pm2}"
trap 'echo "Deploy failed at line $LINENO. Check the error above and pm2 logs nexclean-api --lines 50 --nostream." >&2' ERR

node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("NexClean requires Node.js 22 or newer, including the PM2 runtime."); process.exit(1); }'

echo "==> Pulling latest code"
git pull --ff-only origin main

[[ -f "$REPO_DIR/backend/ecosystem.config.js" ]] || { echo "Missing backend/ecosystem.config.js; deploy the ecosystem configuration first." >&2; exit 1; }

# Validate nginx before changing the running application.
sudo nginx -t

echo "==> Building backend"
cd "$REPO_DIR/backend"
npm ci
npm run build
# Validate the built entry point and production settings before asking PM2 to reload.
[[ -f dist/index.js ]] || { echo "Backend build did not produce dist/index.js" >&2; exit 1; }
NODE_ENV=production node -e 'require("./dist/config/env.js").assertProductionConfig()'

echo "==> Building frontend"
cd "$REPO_DIR/frontend"
npm ci
npm run build
# Guard against a stricter default umask regenerating dist/ as
# non-world-readable, which nginx (running as www-data) needs.
chmod -R o+rX "$REPO_DIR/frontend/dist"

echo "==> Starting/reloading four backend workers"
cd "$REPO_DIR/backend"
pm2 startOrReload ecosystem.config.js --only nexclean-api --update-env

# PM2 accepting a command does not guarantee the API stayed online. Inspect
# only status/count; never print jlist, which includes environment secrets.
verify_workers() {
  pm2 jlist | node -e '
    let input = "";
    process.stdin.on("data", chunk => input += chunk);
    process.stdin.on("end", () => {
      try {
        const workers = JSON.parse(input).filter(p => p.name === "nexclean-api");
        if (workers.length !== 4 || workers.some(p => p.pm2_env.status !== "online" || p.pm2_env.exec_mode !== "cluster_mode")) process.exitCode = 1;
      } catch { process.exitCode = 1; }
    });'
}
# Wait briefly, then require two consecutive successful checks.
workers_ready=false
for attempt in {1..15}; do
  if verify_workers; then
    sleep 2
    if verify_workers; then workers_ready=true; break; fi
  fi
  sleep 1
done
if [[ "$workers_ready" != true ]]; then
  echo "Expected four online cluster workers. Inspect pm2 status and pm2 logs nexclean-api --lines 50 --nostream." >&2
  exit 1
fi
pm2 save

echo "==> Reloading nginx"
sudo systemctl reload nginx

echo "==> Deploy complete"
pm2 status
