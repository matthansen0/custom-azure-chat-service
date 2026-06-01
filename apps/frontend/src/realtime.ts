import { WebPubSubClient } from "@azure/web-pubsub-client";
import { negotiate } from "./api.js";
import type { EventEnvelope } from "./types.js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export async function connectRealtime(input: {
  userId: string;
  onStatus: (status: ConnectionStatus) => void;
  onEvent: (event: EventEnvelope) => void;
}): Promise<() => Promise<void>> {
  input.onStatus("connecting");

  const negotiation = await negotiate(input.userId);

  if (negotiation.kind === "local") {
    const socket = new WebSocket(negotiation.url);

    socket.addEventListener("open", () => {
      input.onStatus("connected");
    });

    socket.addEventListener("close", () => {
      input.onStatus("disconnected");
    });

    socket.addEventListener("message", (messageEvent) => {
      const payload = JSON.parse(String(messageEvent.data)) as { type?: string; event?: EventEnvelope };
      if (payload.event) {
        input.onEvent(payload.event);
      }
    });

    return async () => {
      socket.close();
      input.onStatus("disconnected");
    };
  }

  const client = new WebPubSubClient({
    getClientAccessUrl: async () => (await negotiate(input.userId)).url
  });

  client.on("connected", () => {
    input.onStatus("connected");
  });

  client.on("disconnected", () => {
    input.onStatus("disconnected");
  });

  client.on("server-message", (event) => {
    const payload = event.message.data as { type?: string; event?: EventEnvelope };
    if (payload?.event) {
      input.onEvent(payload.event);
    }
  });

  await client.start();

  return async () => {
    await client.stop();
    input.onStatus("disconnected");
  };
}
