# Runtime Architecture

![Runtime Architecture](runtime-architecture.png)

Editable source: [runtime-architecture.excalidraw](runtime-architecture.excalidraw)

Icon source: RKrokson/msft-icons-excalidraw (official Microsoft Azure architecture icon set packaging).

<details>
<summary>Text-equivalent diagram (Mermaid accessibility fallback)</summary>

```mermaid
flowchart LR
  U[Browser / Client] -->|HTTPS| FE[Frontend Container App]
  FE -->|/api HTTPS| BE[Backend Container App]
  BE -->|publish events| WPS[Azure Web PubSub]
  WPS -->|WebSocket fan-out| U
  BE -->|read/write| COSMOS[Azure Cosmos DB]
  FE -->|telemetry| AI[Application Insights]
  BE -->|telemetry| AI
  AI -->|export| LA[Log Analytics Workspace]
```

</details>
