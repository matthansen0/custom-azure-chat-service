import type { EventEnvelope } from "../events/contracts.js";

export function createProjectionConsumer() {
  const seen = new Set<string>();

  return async (event: EventEnvelope): Promise<void> => {
    // Prototype duplicate suppression for independent consumers.
    if (seen.has(event.eventId)) {
      return;
    }
    seen.add(event.eventId);
  };
}
