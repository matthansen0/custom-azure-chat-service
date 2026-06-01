import { WebPubSubClient } from "@azure/web-pubsub-client";
import { negotiate } from "./api.js";
export async function connectRealtime(input) {
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
            const payload = JSON.parse(String(messageEvent.data));
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
        const payload = event.message.data;
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
