# How It Works

This prototype models chat behavior as domain events rather than direct socket RPC. The API accepts commands such as send message, add reaction, mark read, start typing, and pin room. Each command becomes an explicit event envelope that includes tenant identity, correlation metadata, actor identity, entity identity, version, room/thread targeting, and an idempotency key.

The backend runs those envelopes through independent consumers. One consumer persists the event and updates lightweight projections used by the UI. A separate delivery adapter publishes the same event to Azure Web PubSub. This keeps Web PubSub focused on high-fan-out delivery and avoids pushing domain logic into connection handlers.

For ordering, room-scoped events receive monotonically increasing sequence numbers. This is enough for a convincing prototype without introducing full event sourcing or a broker fleet. Typing and presence stay ephemeral, while message creation, read receipts, and reactions are retained as durable state transitions.

Pass 1 intentionally stops at the architecture skeleton. The backend now includes a signed demo bearer-token flow that models an external IdP handing off to a platform-issued token, plus a realtime negotiate endpoint that only issues Azure Web PubSub access after platform authentication succeeds. The current UI still runs a simplified demo experience, but the ownership boundary now matches the intended production shape.

Pass 2 completes the first working slice on top of that skeleton. The application now supports thread listing, thread open, send message, room-scoped realtime delivery, typing indicators, read receipts, reactions, pinning, and room search backed by a separate projection path. Search no longer scans the transport path directly; a projection consumer rebuilds a searchable room index when message events land.

Pass 3 layers the surrounding platform-owned features around that chat slice without moving logic into the transport channel. Thread administration, participant membership, message edit/delete/delivery/priority changes, archive/hide/mark-unread/follow-up state, notification preferences, quick templates, directory filtering, linked context, assignment-driven membership, and audit views all ride through the same command-to-event-to-consumer path. The UI remains a prototype, but the behavior boundaries are explicit and testable.

For local development, the system uses an in-process WebSocket delivery adapter when Azure Web PubSub is not configured. Azure Web PubSub remains the primary production-facing realtime backbone, but the local fallback allows automated UX validation and multi-user demos without external infrastructure.

Cosmos DB is set up with containers intended for room-scoped event storage and projection state. The partition strategy follows the main query patterns: event-log writes and room timeline reads are room-centric, so the event container uses a room-based partition key. Projection state uses an entity partition field so room summaries, membership snapshots, and typing/presence records can be grouped by the projection they belong to.

The current repository keeps the authoritative event contracts richer than the current user-facing slice. Event types already cover thread, participant, preference, notification, audit, and template concepts needed by later passes, even though the initial UI only exercises a subset of them. That is deliberate: Pass 1 is about stabilizing the platform seams before expanding the commodity chat feature set in Pass 2.

The development workflow is dev-container-first. The repo is meant to be opened in the provided container, which installs Node, Azure CLI, and azd, then performs workspace dependency installation inside the container. Local host installs are intentionally not part of the supported workflow.

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
