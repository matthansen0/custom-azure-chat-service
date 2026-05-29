#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"

pass() {
  printf 'PASS: %s\n' "$1"
}

skip() {
  printf 'SKIP: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1"
  exit 1
}

if [[ "$mode" == "--static" ]]; then
  [[ -f azure.yaml ]] || fail "azure.yaml exists"
  [[ -f infra/main.bicep ]] || fail "infra/main.bicep exists"
  [[ -f .devcontainer/devcontainer.json ]] || fail "dev container exists"
  [[ -f apps/backend/src/index.ts ]] || fail "backend entry exists"
  [[ -f apps/frontend/src/App.tsx ]] || fail "frontend app exists"
  [[ -f apps/backend/.env.example ]] || fail "backend env example exists"
  [[ -f playwright.config.ts ]] || fail "playwright config exists"
  pass "static repo skeleton checks"
  exit 0
fi

if [[ "$mode" == "--local" ]]; then
  npm run test --workspace @chat/backend
  pass "backend unit tests"

  npm run typecheck
  pass "workspace typecheck"

  npm run test:e2e
  pass "playwright local smoke"
  exit 0
fi

frontend_url="${CHAT_FRONTEND_URL:-}"
api_url="${CHAT_API_URL:-}"

if [[ -z "$frontend_url" || -z "$api_url" ]]; then
  skip "live validation requires CHAT_FRONTEND_URL and CHAT_API_URL"
  exit 0
fi

health_json="$(curl --silent --show-error --fail "$api_url/health")" || fail "backend health endpoint"
[[ "$health_json" == *'"ok":true'* ]] || fail "backend health payload"
pass "backend health endpoint"

frontend_status="$(curl --silent --show-error --location --write-out '%{http_code}' --output /tmp/chat-frontend.html "$frontend_url")" || fail "frontend reachability"
[[ "$frontend_status" == "200" ]] || fail "frontend status code"
pass "frontend reachability"

skip "deeper live checks land in Pass 2 and Pass 3"
