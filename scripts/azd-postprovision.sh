#!/usr/bin/env bash
set -euo pipefail

eval "$(azd env get-values)"

if [[ -z "${AZURE_RESOURCE_GROUP:-}" || -z "${AZURE_CONTAINER_REGISTRY_NAME:-}" || -z "${BACKEND_URL:-}" || -z "${FRONTEND_URL:-}" ]]; then
  echo "Missing azd environment values required for deployment."
  exit 1
fi

backend_image="${AZURE_CONTAINER_REGISTRY_LOGIN_SERVER}/backend:$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
frontend_image="${AZURE_CONTAINER_REGISTRY_LOGIN_SERVER}/frontend:$(git rev-parse --short HEAD 2>/dev/null || echo dev)"

az acr build \
  --registry "$AZURE_CONTAINER_REGISTRY_NAME" \
  --image "${backend_image#${AZURE_CONTAINER_REGISTRY_LOGIN_SERVER}/}" \
  --file apps/backend/Dockerfile \
  .

az acr build \
  --registry "$AZURE_CONTAINER_REGISTRY_NAME" \
  --image "${frontend_image#${AZURE_CONTAINER_REGISTRY_LOGIN_SERVER}/}" \
  --build-arg "VITE_API_BASE_URL=${BACKEND_URL}/api" \
  --file apps/frontend/Dockerfile \
  .

az containerapp update \
  --name "$AZURE_BACKEND_CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --image "$backend_image" \
  --set-env-vars "CORS_ORIGIN=${FRONTEND_URL}"

az containerapp ingress update \
  --name "$AZURE_BACKEND_CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --target-port 8080 \
  --type external

az containerapp update \
  --name "$AZURE_FRONTEND_CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --image "$frontend_image"

echo "Backend URL: ${BACKEND_URL}"
echo "Frontend URL: ${FRONTEND_URL}"