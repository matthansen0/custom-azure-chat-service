import { WebPubSubClient } from "@azure/web-pubsub-client";
import { negotiate } from "./api.js";
export async function connectRealtime(input) {
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
        const payload = event.message.data;
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
