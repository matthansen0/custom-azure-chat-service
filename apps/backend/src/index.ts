import { createServer } from "node:http";
import { createChatApp } from "./app.js";
import { config } from "./config.js";
import { LocalRealtimePublisher, WebPubSubPublisher } from "./eventing/publisher.js";
import { CosmosStore, MemoryStore } from "./persistence/store.js";

const store =
  config.cosmosEndpoint
    ? new CosmosStore({
        endpoint: config.cosmosEndpoint,
        database: config.cosmosDatabase,
        eventsContainer: config.cosmosEventsContainer
      })
    : new MemoryStore();

await store.ensureSeedData();

const httpServer = createServer();

const publisher = config.webPubSubEndpoint
  ? new WebPubSubPublisher(config.webPubSubEndpoint, config.webPubSubHub, store)
  : new LocalRealtimePublisher({
      server: httpServer,
      store,
      secret: config.demoAuthSecret,
      port: config.port
    });

const { app } = createChatApp({
  corsOrigin: config.corsOrigin,
  store,
  publisher
});

httpServer.on("request", app);

httpServer.listen(config.port, () => {
  console.log(`chat backend running on http://localhost:${config.port}`);
});
