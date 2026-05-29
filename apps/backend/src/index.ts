import cors from "cors";
import express from "express";
import { ChatCommands } from "./commands/chatCommands.js";
import { config } from "./config.js";
import { createPersistenceConsumer } from "./consumers/persistenceConsumer.js";
import { createProjectionConsumer } from "./consumers/projectionConsumer.js";
import { EventRouter } from "./eventing/router.js";
import { NoopPublisher, WebPubSubPublisher } from "./eventing/publisher.js";
import { CosmosStore, MemoryStore } from "./persistence/store.js";
import { createApiRouter } from "./routes/api.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

const store =
  config.cosmosEndpoint && config.cosmosKey
    ? new CosmosStore({
        endpoint: config.cosmosEndpoint,
        key: config.cosmosKey,
        database: config.cosmosDatabase,
        eventsContainer: config.cosmosEventsContainer
      })
    : new MemoryStore();

await store.ensureSeedData();

const publisher = config.webPubSubConnectionString
  ? new WebPubSubPublisher(config.webPubSubConnectionString, config.webPubSubHub)
  : new NoopPublisher();

const commands = new ChatCommands(store);
const router = new EventRouter();
router.register(createPersistenceConsumer(store));
router.register(createProjectionConsumer());

app.use("/api", createApiRouter({ commands, eventRouter: router, publisher, store }));

app.listen(config.port, () => {
  console.log(`chat backend running on http://localhost:${config.port}`);
});
