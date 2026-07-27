#!/usr/bin/env bash
# E2E test for Symptom Understanding v1 (GRAPH_RAG_PROVIDER=static).
# Plan: e2e/symptom-understanding-v1-plan.md — read that first, this is the
# mechanical half.
#
# Usage:
#   ./e2e/symptom-understanding-v1.sh            # Scenarios A + B (feature on)
#   ./e2e/symptom-understanding-v1.sh --off       # Scenario D (feature off, baseline)
#
# Requires: doppler configured, playwright-cli on PATH, a real Chrome install.
# First run: log in by hand once in the Chrome window this script opens — the
# profile persists, so every later run starts already authenticated.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME_PROFILE="${HOME}/.cache/medicoord-e2e-chrome-profile"
CHROME_DEBUG_PORT=9222
BACKEND_PORT=8000
FRONTEND_PORT=5173
LOG_DIR="$(mktemp -d)"
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
GRAPH_RAG_PROVIDER_VALUE="static"

if [[ "${1:-}" == "--off" ]]; then
  GRAPH_RAG_PROVIDER_VALUE="off"
  echo "== Scenario D: GRAPH_RAG_PROVIDER=off (regression baseline) =="
else
  echo "== Scenarios A + B: GRAPH_RAG_PROVIDER=static =="
fi
echo "Logs: ${LOG_DIR}"

cleanup() {
  echo
  echo "== Cleanup =="
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "${CHROME_PID:-}" ]] && kill "$CHROME_PID" 2>/dev/null || true
  playwright-cli close 2>/dev/null || true
  echo "Backend log:  ${BACKEND_LOG}"
  echo "Frontend log: ${FRONTEND_LOG}"
}
trap cleanup EXIT

wait_for_port() {
  local port=$1 name=$2 tries=60
  echo -n "Waiting for ${name} on :${port} "
  until curl -sf "http://localhost:${port}" >/dev/null 2>&1 || [[ $tries -eq 0 ]]; do
    echo -n "."
    sleep 1
    tries=$((tries - 1))
  done
  echo
  if [[ $tries -eq 0 ]]; then
    echo "ERROR: ${name} never came up on :${port}. See its log."
    exit 1
  fi
}

# --- Start backend ---
echo "== Starting backend (GRAPH_RAG_PROVIDER=${GRAPH_RAG_PROVIDER_VALUE}) =="
(
  cd "${REPO_ROOT}/backend"
  export GRAPH_RAG_PROVIDER="${GRAPH_RAG_PROVIDER_VALUE}"
  doppler run -- uvicorn main:app --port "${BACKEND_PORT}" > "${BACKEND_LOG}" 2>&1 &
  echo $! > "${LOG_DIR}/backend.pid"
)
BACKEND_PID=$(cat "${LOG_DIR}/backend.pid")
wait_for_port "${BACKEND_PORT}" backend

# --- Start frontend ---
echo "== Starting frontend =="
(
  cd "${REPO_ROOT}/webapp"
  npm run doppler-dev > "${FRONTEND_LOG}" 2>&1 &
  echo $! > "${LOG_DIR}/frontend.pid"
)
FRONTEND_PID=$(cat "${LOG_DIR}/frontend.pid")
wait_for_port "${FRONTEND_PORT}" frontend

# --- Launch Chrome with remote debugging, persistent profile ---
echo "== Launching Chrome (remote debugging on :${CHROME_DEBUG_PORT}) =="
CHROME_BIN="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
if [[ -z "${CHROME_BIN}" ]]; then
  echo "ERROR: no Chrome/Chromium binary found on PATH."
  exit 1
fi
mkdir -p "${CHROME_PROFILE}"
"${CHROME_BIN}" \
  --remote-debugging-port="${CHROME_DEBUG_PORT}" \
  --user-data-dir="${CHROME_PROFILE}" \
  --no-first-run --no-default-browser-check \
  "http://localhost:${FRONTEND_PORT}/app" &
CHROME_PID=$!
sleep 2

playwright-cli attach --cdp="http://localhost:${CHROME_DEBUG_PORT}"

# Grant geolocation so the "always share location" path doesn't hang on a
# permission prompt — Toronto downtown, matching the app's stated city.
playwright-cli run-code "async page => { await page.context().grantPermissions(['geolocation']); await page.context().setGeolocation({ latitude: 43.6532, longitude: -79.3832 }); }"

playwright-cli goto "http://localhost:${FRONTEND_PORT}/app"
playwright-cli snapshot --filename="${LOG_DIR}/00-initial.yml"

# --- Auth check ---
if grep -q "Sign in to start a conversation" "${LOG_DIR}/00-initial.yml"; then
  echo
  echo "== Not authenticated in this Chrome profile =="
  echo "Log in by hand in the Chrome window now (email/password)."
  echo "This profile persists at ${CHROME_PROFILE} — you only do this once."
  read -rp "Press Enter once you're logged in and the chat input is enabled... "
  playwright-cli snapshot --filename="${LOG_DIR}/01-after-login.yml"
fi

# --- Helpers ---
send_message() {
  local text=$1
  echo "  > \"${text}\""
  playwright-cli fill "getByPlaceholder('Describe how you feel…')" "${text}"
  playwright-cli press Enter
  # Wait for the actual chat round-trip rather than guessing a sleep duration.
  playwright-cli run-code "async page => { try { await page.waitForResponse(r => r.url().includes('/chat/message') && r.status() === 200, { timeout: 20000 }); } catch (e) { console.log('WARN: no /chat/message response observed within 20s'); } }"
}

check_match_logged() {
  local label=$1
  if tail -n 50 "${BACKEND_LOG}" | grep -q "graph_context_matched"; then
    echo "  [MATCH]    ${label}: graph_context_matched found in backend log"
    tail -n 50 "${BACKEND_LOG}" | grep "graph_context_matched" | tail -1
  else
    echo "  [NO MATCH] ${label}: no graph_context_matched in recent backend log"
  fi
}

if [[ "${GRAPH_RAG_PROVIDER_VALUE}" == "static" ]]; then
  echo
  echo "== Scenario A: match fires, turn-level union carries it forward =="
  send_message "angina"
  check_match_logged "turn 1 (angina, expect MATCH: Chest pain (cardiac features))"
  send_message "it started about an hour ago"
  check_match_logged "turn 2 (no symptom keyword, expect MATCH via turn union)"
  playwright-cli snapshot --filename="${LOG_DIR}/02-scenario-a.yml"

  echo
  echo "== Scenario B: no match, no false positive (new session) =="
  playwright-cli goto "http://localhost:${FRONTEND_PORT}/app"
  send_message "I have a mild headache"
  check_match_logged "turn 1 (headache, expect NO MATCH)"
  playwright-cli snapshot --filename="${LOG_DIR}/03-scenario-b.yml"
else
  echo
  echo "== Scenario D: flag off, regression baseline =="
  send_message "angina"
  if grep -q "graph_context_matched" "${BACKEND_LOG}"; then
    echo "  [FAIL] graph_context_matched appeared with GRAPH_RAG_PROVIDER=off — NullGraphProvider is not a no-op."
  else
    echo "  [PASS] no graph_context_matched anywhere in the log with the flag off."
  fi
  playwright-cli snapshot --filename="${LOG_DIR}/04-scenario-d.yml"
fi

echo
echo "== Console errors (should be empty) =="
playwright-cli console error

echo
echo "== Done. Review snapshots and logs in ${LOG_DIR} =="
echo "Chrome and the dev servers are left running — rerun with the browser already"
echo "open and authenticated. Ctrl+C or close this shell to tear everything down."
wait
