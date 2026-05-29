#!/usr/bin/env bash
set -euo pipefail

eval "$(azd env get-values)"

account_name="${COSMOSACCOUNTNAME:-${AZURE_COSMOS_ACCOUNT_NAME:-${COSMOSACCOUNT:-}}}"

if [[ -z "$account_name" ]]; then
  echo "No Cosmos DB account name found in azd environment; skipping delete wait."
  exit 0
fi

echo "Waiting for Cosmos DB account '$account_name' to be fully released..."

for attempt in $(seq 1 60); do
  name_exists="$(az cosmosdb check-name-exists --name "$account_name" --query nameExists -o tsv 2>/dev/null || echo false)"
  if [[ "$name_exists" == "false" ]]; then
    echo "Cosmos DB account name '$account_name' is available again."
    exit 0
  fi
  echo "Attempt $attempt/60: Cosmos account name still reserved; waiting 10s..."
  sleep 10
done

echo "Cosmos DB account name '$account_name' is still reserved after waiting."
exit 1