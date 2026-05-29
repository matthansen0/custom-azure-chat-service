import { WebPubSubServiceClient } from "@azure/web-pubsub";
import type { EventEnvelope } from "../events/contracts.js";

export interface RealtimePublisher {
  publish(event: EventEnvelope): Promise<void>;
  getClientAccessToken(userId: string): Promise<{ url: string }>;
}

export class NoopPublisher implements RealtimePublisher {
  async publish(_event: EventEnvelope): Promise<void> {
    return;
  }

  async getClientAccessToken(_userId: string): Promise<{ url: string }> {
    return { url: "" };
  }
}

export class WebPubSubPublisher implements RealtimePublisher {
  private readonly serviceClient: WebPubSubServiceClient;

  constructor(connectionString: string, hub: string) {
    this.serviceClient = new WebPubSubServiceClient(connectionString, hub);
  }

  async publish(event: EventEnvelope): Promise<void> {
    if (!event.roomId) {
      await this.serviceClient.sendToAll({ type: "event", event });
      return;
    }
    await this.serviceClient.group(`room-${event.roomId}`).sendToAll({ type: "event", event });
  }

  async getClientAccessToken(userId: string): Promise<{ url: string }> {
    const token = await this.serviceClient.getClientAccessToken({
      userId,
      roles: ["webpubsub.joinLeaveGroup", "webpubsub.sendToGroup"]
    });
    return { url: token.url };
  }
}
