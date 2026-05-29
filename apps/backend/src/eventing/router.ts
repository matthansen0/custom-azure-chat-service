import type { EventEnvelope } from "../events/contracts.js";

export type EventConsumer = (event: EventEnvelope) => Promise<void>;

export class EventRouter {
  private readonly consumers: EventConsumer[] = [];

  register(consumer: EventConsumer): void {
    this.consumers.push(consumer);
  }

  async handle(event: EventEnvelope): Promise<void> {
    for (const consumer of this.consumers) {
      await consumer(event);
    }
  }
}
