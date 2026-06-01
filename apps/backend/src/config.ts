import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 8080),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  demoTenantId: process.env.DEMO_TENANT_ID ?? "tenant-demo",
  demoAuthSecret: process.env.DEMO_AUTH_SECRET ?? "dev-only-demo-secret-change-me",
  demoAuthTokenTtlMinutes: Number(process.env.DEMO_AUTH_TOKEN_TTL_MINUTES ?? 60),
  webPubSubEndpoint: process.env.WEB_PUBSUB_ENDPOINT ?? "",
  webPubSubHub: process.env.WEB_PUBSUB_HUB ?? "chat",
  cosmosEndpoint: process.env.COSMOS_ENDPOINT ?? "",
  cosmosDatabase: process.env.COSMOS_DATABASE ?? "chatPrototype",
  cosmosEventsContainer: process.env.COSMOS_EVENTS_CONTAINER ?? "events",
  cosmosStateContainer: process.env.COSMOS_STATE_CONTAINER ?? "state"
};
