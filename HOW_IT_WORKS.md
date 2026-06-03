# How It Works

## Detailed Architecture

![Detailed Architecture](docs/architecture.png)

Editable source: [docs/architecture.excalidraw](docs/architecture.excalidraw)

Accessibility fallback: [docs/architecture.md](docs/architecture.md)

## Design Decisions

### Why model chat as events instead of socket RPC?

The main decision is that chat behavior belongs to platform-owned services, not to connection handlers. Commands come in through HTTP, become typed events, and then independent consumers persist and project those events. This keeps business decisions testable and replayable without depending on the realtime transport.

### Why Azure Web PubSub and not hub-driven backend logic?

Azure Web PubSub is used for fan-out only. It is the delivery plane, not the source of truth. Reactions, read receipts, unread state, templates, notification preferences, context linkage, directory lookups, and audit records all live outside the socket layer so that reconnects, retries, and alternative clients do not change the business model.

### Why keep a local realtime fallback?

The local in-process WebSocket publisher exists strictly for developer productivity and automated validation. It preserves the same event-delivery contract as the Azure Web PubSub path, which lets Playwright exercise the full UX without an Azure subscription in the loop.

### Why Container Apps for hosting?

The backend is a Node/Express app and the frontend already builds cleanly into static assets. Container Apps provides a pragmatic Azure-hosted runtime for both without changing the application structure. The frontend is packaged into an nginx-based image, while the backend runs as a compiled Node service.

### Why wait for Cosmos account-name release on `azd down`?

Cosmos account names are globally unique and can remain reserved for a short period after deletion starts. The `postdown` hook waits until `az cosmosdb check-name-exists` reports the name as available again so teardown and redeploy loops do not fail on name conflicts.

## Deployment Flow

1. `azd up` provisions the resource group, ACR, Container Apps environment, backend/frontend container apps, Web PubSub, Cosmos DB, App Insights, and Log Analytics.
2. `scripts/azd-postprovision.sh` loads the `azd` environment outputs, builds both images in ACR, and updates the two Container Apps to the newly built revisions.
3. The frontend is built with the resolved backend URL, so its runtime configuration points at the deployed backend API.
4. The backend is updated with the resolved frontend URL for CORS and uses the provisioned Cosmos and Web PubSub resources.
5. `azd down --force --purge` tears the stack down and then `scripts/azd-postdown.sh` waits for Cosmos account-name release.

## Validation model

Validation is now layered to match the intended Azure workflow:

1. `bash scripts/validate.sh --static` checks the repo skeleton expected by azd.
2. `bash scripts/validate.sh --local` runs backend unit tests, workspace typecheck, and Playwright smoke coverage against local dev servers.
3. `bash scripts/validate.sh` is the live validation entry point for deployed Azure resources. It currently performs health checks when deployment URLs are provided and clearly reports `SKIP` when live infrastructure is not available yet.

The local validator now covers three browser flows:

- Pass 1 shell bootstrapping
- Pass 2 realtime chat behavior
- Pass 3 admin and lifecycle behavior
