import { WebPubSubClient } from "@azure/web-pubsub-client";
import { negotiate } from "./api.js";
import type { EventEnvelope } from "./types.js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export async function connectRealtime(input: {
  userId: string;
  roomId: string;
  onStatus: (status: ConnectionStatus) => void;
  onEvent: (event: EventEnvelope) => void;
}): Promise<() => Promise<void>> {
  input.onStatus("connecting");

  const client = new WebPubSubClient({
    getClientAccessUrl: async () => negotiate(input.userId)
  });

  client.on("connected", async () => {
    input.onStatus("connected");
    await client.joinGroup(`room-${input.roomId}`);
  });

  client.on("disconnected", () => {
    input.onStatus("disconnected");
  });

  client.on("group-message", (event) => {
    const payload = event.message.data as { type?: string; event?: EventEnvelope };
    if (payload?.event) {
      input.onEvent(payload.event);
    }
  });

  await client.start();

  return async () => {
    await client.leaveGroup(`room-${input.roomId}`);
    await client.stop();
    input.onStatus("disconnected");
  };
}
