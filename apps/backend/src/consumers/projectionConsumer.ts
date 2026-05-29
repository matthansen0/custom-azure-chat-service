import type { DataStore } from "../persistence/store.js";
import type { EventEnvelope } from "../events/contracts.js";

export function createProjectionConsumer(store: DataStore) {
  const seen = new Set<string>();

  return async (event: EventEnvelope): Promise<void> => {
    // Prototype duplicate suppression for independent consumers.
    if (seen.has(event.eventId)) {
      return;
    }
    seen.add(event.eventId);

    switch (event.eventType) {
      case "MessageCreated":
      case "MessageEdited":
      case "MessageDeleted": {
        if (event.roomId) {
          await store.rebuildSearchProjection(event.roomId);
        }
        break;
      }
      default:
        break;
    }
  };
}
