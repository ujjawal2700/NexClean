#!/usr/bin/env bash
# Boots the backend + frontend against a disposable LOCAL MongoDB database
# (never the real backend/.env Atlas cluster) and runs the full Playwright
# suite (API + all three E2E role apps) against them.
#
# Usage:
#   ./run-all.sh                 # full suite (api + customer/agent/admin e2e)
#   ./run-all.sh --project=api   # forwarded straight to `playwright test`
#   ./run-all.sh --grep=booking  # any playwright test CLI flag works
#
# Safety: MONGODB_URI is hard-overridden below to a local `nexclean-test`
# database on 127.0.0.1:27017, regardless of what backend/.env contains, so
# this can never write test data into a shared/production database.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
TESTS_DIR="$ROOT_DIR/tests"
LOG_DIR="$TESTS_DIR/.run-logs"
mkdir -p "$LOG_DIR"

BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
export API_BASE_URL="http://localhost:${BACKEND_PORT}/api"
export WEB_BASE_URL="http://localhost:${FRONTEND_PORT}"

BACKEND_PID=""
FRONTEND_PID=""
STARTED_BACKEND=0
STARTED_FRONTEND=0

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

port_listening() {
  lsof -iTCP:"$1" -sTCP:LISTEN -P >/dev/null 2>&1
}

wait_for() {
  local url="$1" label="$2" tries=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 60 ]; then
      fail "$label never became ready at $url (see $LOG_DIR)"
    fi
    sleep 1
  done
}

cleanup() {
  if [ "$STARTED_BACKEND" = "1" ] && [ -n "$BACKEND_PID" ]; then
    log "Stopping backend (pid $BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ "$STARTED_FRONTEND" = "1" ] && [ -n "$FRONTEND_PID" ]; then
    log "Stopping frontend (pid $FRONTEND_PID)"
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! pgrep -x mongod >/dev/null 2>&1 && ! port_listening 27017; then
  fail "Local MongoDB isn't running on :27017. Start it (e.g. 'brew services start mongodb-community') first."
fi

if port_listening "$BACKEND_PORT"; then
  log "Backend already listening on :$BACKEND_PORT — reusing it (make sure it's pointed at the local test DB!)"
else
  # Reset the disposable test DB before every full run. A dispatch flow test
  # in particular relies on a live agent's geo-eligibility query, which can
  # become unreliable once hundreds of stale "searching"/"pending_admin"
  # bookings from prior runs pile up uncleaned in the same local database —
  # starting fresh avoids that entirely and keeps runs reproducible.
  #
  # Resolve mongosh explicitly rather than trusting PATH: Homebrew puts it in
  # /opt/homebrew/bin, which an interactive shell has but a runner's environment
  # often does not. This used to be a bare `command -v mongosh` guard that
  # silently skipped the reset when it missed — so runs quietly stopped being
  # reproducible and state piled up across them. That is not a harmless skip:
  # the referral-farming test counts prior referred signups from the same IP,
  # and once enough accumulate it fails on a code path that is working fine.
  # Hence the loud warning when the tool genuinely isn't there.
  MONGOSH_BIN=""
  for candidate in "${MONGOSH_PATH:-}" mongosh /opt/homebrew/bin/mongosh /usr/local/bin/mongosh; do
    [ -z "$candidate" ] && continue
    if command -v "$candidate" >/dev/null 2>&1; then MONGOSH_BIN="$candidate"; break; fi
  done

  if [ -n "$MONGOSH_BIN" ]; then
    log "Resetting local test DB (nexclean-test)"
    "$MONGOSH_BIN" --quiet nexclean-test --eval "db.dropDatabase()" >/dev/null
    export MONGOSH_PATH="$MONGOSH_BIN"
  else
    printf '\n\033[1;33m⚠ mongosh not found — SKIPPING the test-DB reset.\033[0m\n'
    printf '  Runs are no longer reproducible: state accumulates across runs and\n'
    printf '  tests that count prior records (e.g. referral farming) will fail for\n'
    printf '  reasons unrelated to your change. Install it, or set MONGOSH_PATH.\n\n'
  fi
  log "Starting backend on :$BACKEND_PORT against local test DB (nexclean-test)"
  (
    cd "$BACKEND_DIR"
    export PORT=$BACKEND_PORT
    export NODE_ENV=test
    export MONGODB_URI="mongodb://127.0.0.1:27017/nexclean-test"
    export JWT_SECRET="test-secret-key-1234567890-test-key"
    export JWT_EXPIRES_IN="30d"
    export DEMO_OTP="123456"
    # Demo agents are opt-in now (see backend/src/config/seed.ts) so a real
    # deployment can never quietly create loginable accounts. The suite depends
    # on them heavily — the KYC gate, agent login, admin agent lists, area
    # alerts and campaign audiences all address a seeded cleaner by phone — so
    # the throwaway test backend opts in explicitly.
    export SEED_DEMO_AGENTS="true"
    export CLIENT_ORIGIN="http://localhost:${FRONTEND_PORT}"
    export ADMIN_EMAIL="superadmin@gmail.com"
    export ADMIN_PASSWORD="password123"
    # Force-empty even though backend/.env has real keys for these — the test
    # suite is written against the documented mock-mode behavior (no external
    # network calls, deterministic "order_mock_..." ids). dotenv never
    # overrides a var already present in process.env, so these empty strings
    # win over whatever backend/.env has, without editing that file.
    export RAZORPAY_KEY_ID=""
    export RAZORPAY_KEY_SECRET=""
    export CLOUDINARY_CLOUD_NAME=""
    export CLOUDINARY_API_KEY=""
    export CLOUDINARY_API_SECRET=""
    export FIREBASE_SERVICE_ACCOUNT_BASE64=""
    exec npm run test-start
  ) >"$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  STARTED_BACKEND=1
  wait_for "http://localhost:${BACKEND_PORT}/api/health" "backend"
fi

if port_listening "$FRONTEND_PORT"; then
  log "Frontend already listening on :$FRONTEND_PORT — reusing it"
else
  log "Starting frontend on :$FRONTEND_PORT"
  (
    cd "$FRONTEND_DIR"
    export VITE_API_URL="http://localhost:${BACKEND_PORT}/api"
    exec npm run dev -- --port "$FRONTEND_PORT" --strictPort
  ) >"$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  STARTED_FRONTEND=1
  wait_for "http://localhost:${FRONTEND_PORT}/" "frontend"
fi

log "Backend + frontend healthy. Running Playwright suite..."
cd "$TESTS_DIR"
set +e
npx playwright test "$@"
STATUS=$?
set -e

if [ $STATUS -eq 0 ]; then
  log "All tests passed ✓  (HTML report: tests/playwright-report/index.html)"
else
  log "Some tests FAILED (exit $STATUS). Logs: $LOG_DIR  Report: tests/playwright-report/index.html"
fi
exit $STATUS
