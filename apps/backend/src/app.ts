import cors from "cors";
import express, { type Express } from "express";
import { ChatCommands } from "./commands/chatCommands.js";
import { createPersistenceConsumer } from "./consumers/persistenceConsumer.js";
import { createProjectionConsumer } from "./consumers/projectionConsumer.js";
import { EventRouter } from "./eventing/router.js";
import type { RealtimePublisher } from "./eventing/publisher.js";
import type { DataStore } from "./persistence/store.js";
import { createApiRouter } from "./routes/api.js";

export function createChatApp(input: {
  corsOrigin: string;
  store: DataStore;
  publisher: RealtimePublisher;
}): {
  app: Express;
  commands: ChatCommands;
  eventRouter: EventRouter;
} {
  const app = express();
  app.use(cors({ origin: input.corsOrigin }));
  app.use(express.json());

  const commands = new ChatCommands(input.store);
  const eventRouter = new EventRouter();
  eventRouter.register(createPersistenceConsumer(input.store));
  eventRouter.register(createProjectionConsumer(input.store));

  app.use(
    "/api",
    createApiRouter({
      commands,
      eventRouter,
      publisher: input.publisher,
      store: input.store
    })
  );

  return { app, commands, eventRouter };
}