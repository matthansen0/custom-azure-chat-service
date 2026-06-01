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
  [[ -f docs/architecture.svg ]] || fail "architecture diagram exists"
  [[ -f scripts/azd-postprovision.sh ]] || fail "azd postprovision hook exists"
  [[ -f scripts/azd-postdown.sh ]] || fail "azd postdown hook exists"

  # Security posture: no key-based Cosmos auth, no Web PubSub connection string in code/infra.
  if grep -RInE "process\.env\.COSMOS_KEY|cosmosKey" apps/backend/src >/dev/null; then
    fail "backend code must not reference COSMOS_KEY (use DefaultAzureCredential)"
  fi
  if grep -RInE "process\.env\.WEB_PUBSUB_CONNECTION_STRING|webPubSubConnectionString" apps/backend/src >/dev/null; then
    fail "backend code must not reference Web PubSub connection string (use DefaultAzureCredential)"
  fi
  if grep -nE "COSMOS_KEY|primaryKey" infra/main.bicep >/dev/null; then
    fail "infra/main.bicep must not plumb Cosmos master keys"
  fi
  if ! grep -nE "disableLocalAuth: *true" infra/modules/cosmosdb.bicep >/dev/null; then
    fail "infra/modules/cosmosdb.bicep must set disableLocalAuth: true"
  fi
  if ! grep -nE "disableLocalAuth: *true" infra/modules/webpubsub.bicep >/dev/null; then
    fail "infra/modules/webpubsub.bicep must set disableLocalAuth: true"
  fi
  if ! grep -nE "type: *'SystemAssigned'" infra/modules/container-app.bicep >/dev/null; then
    fail "infra/modules/container-app.bicep must enable system-assigned managed identity"
  fi
  pass "static repo skeleton checks"
  exit 0
fi

if [[ "$mode" == "--azure" ]]; then
  : "${AZURE_RESOURCE_GROUP:?AZURE_RESOURCE_GROUP required for --azure}"
  : "${AZURE_COSMOS_ACCOUNT_NAME:?AZURE_COSMOS_ACCOUNT_NAME required for --azure}"
  : "${AZURE_BACKEND_CONTAINER_APP_NAME:?AZURE_BACKEND_CONTAINER_APP_NAME required for --azure}"
  : "${WEB_PUBSUB_NAME:?WEB_PUBSUB_NAME required for --azure}"

  local_auth="$(az cosmosdb show -n "$AZURE_COSMOS_ACCOUNT_NAME" -g "$AZURE_RESOURCE_GROUP" --query disableLocalAuth -o tsv)"
  [[ "$local_auth" == "true" ]] || fail "Cosmos disableLocalAuth must be true (got: $local_auth)"
  pass "Cosmos disableLocalAuth is true"

  wps_local_auth="$(az webpubsub show -n "$WEB_PUBSUB_NAME" -g "$AZURE_RESOURCE_GROUP" --query disableLocalAuth -o tsv)"
  [[ "$wps_local_auth" == "true" ]] || fail "Web PubSub disableLocalAuth must be true (got: $wps_local_auth)"
  pass "Web PubSub disableLocalAuth is true"

  principal_id="$(az containerapp show -n "$AZURE_BACKEND_CONTAINER_APP_NAME" -g "$AZURE_RESOURCE_GROUP" --query identity.principalId -o tsv)"
  [[ -n "$principal_id" && "$principal_id" != "null" ]] || fail "backend container app has no system-assigned MI"
  pass "backend container app has system-assigned MI ($principal_id)"

  role_count="$(az cosmosdb sql role assignment list \
    --account-name "$AZURE_COSMOS_ACCOUNT_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query "length([?principalId=='$principal_id'])" -o tsv)"
  [[ "$role_count" =~ ^[1-9] ]] || fail "no Cosmos SQL RBAC assignment found for backend MI"
  pass "Cosmos SQL RBAC assigned to backend MI"

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
