# Copilot Instructions — custom-azure-chat-service

## Project Purpose

Prototype a real-time chat application using an event-driven architecture with React, Node.js, Azure Web PubSub, and Cosmos DB. The backend treats chat actions as events, uses Web PubSub for fan-out delivery, and keeps transport concerns separate from business logic.

## Architecture Overview

```text
React UI -> Express API -> command handlers -> event router -> persistence/projection consumers -> Web PubSub delivery
                                         \-> Cosmos-backed event/projection state
```

Key components:
- `apps/frontend` is the demo UI for rooms, messages, reactions, typing, read receipts, presence, and pinning.
- `apps/backend` accepts commands, creates typed event envelopes, runs consumers, and publishes room-scoped events.
- `infra/` will hold azd + Bicep provisioning for Azure Web PubSub, Cosmos DB, and app hosting.
- `.devcontainer/` is the required development environment; do not rely on local installs.

## Code Layout

```text
<repo-root>/
├── .devcontainer/
├── apps/
│   ├── backend/
│   └── frontend/
├── infra/
├── scripts/
└── docs/
```

## Key Files

| File | Purpose |
|---|---|
| `.devcontainer/devcontainer.json` | Required dev environment definition |
| `apps/backend/src/index.ts` | Express app composition |
| `apps/backend/src/commands/chatCommands.ts` | Command-to-event creation |
| `apps/backend/src/consumers/persistenceConsumer.ts` | Event persistence and state updates |
| `apps/backend/src/eventing/publisher.ts` | Azure Web PubSub delivery adapter |
| `apps/frontend/src/App.tsx` | Demo chat shell |

## Common Operations

### Install
```bash
npm install
```

### Run
```bash
npm run dev
```

### Typecheck
```bash
npm run typecheck
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Backend port |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin |
| `WEB_PUBSUB_CONNECTION_STRING` | empty | Azure Web PubSub connection string |
| `WEB_PUBSUB_HUB` | `chat` | Web PubSub hub name |
| `COSMOS_ENDPOINT` | empty | Cosmos DB endpoint |
| `COSMOS_KEY` | empty | Cosmos DB key |

## Conventions

- Develop and validate inside the dev container, not on the local host.
- Keep command handling, event consumption, projections, and Web PubSub delivery separate.
- Treat WebSockets as delivery only; do not move business logic into socket handlers.
- Prefer narrow, incremental changes with immediate validation.

## Things To Avoid

- Do not add SignalR hubs or RPC-style socket workflows.
- Do not couple publishers to subscribers.
- Do not rely on local machine prerequisites when the dev container can own them.
