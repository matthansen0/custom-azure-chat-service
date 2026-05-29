import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { WebSocket } from "ws";
import { LocalRealtimePublisher } from "../src/eventing/publisher.js";
import { MemoryStore } from "../src/persistence/store.js";
import type { EventEnvelope } from "../src/events/contracts.js";

test("LocalRealtimePublisher delivers room events to subscribed clients", async () => {
  const server = createServer();
  const store = new MemoryStore();
  await store.ensureSeedData();

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP server address");
  }

  const publisher = new LocalRealtimePublisher({
    server,
    store,
    secret: "unit-test-secret",
    port: address.port
  });

  const negotiation = await publisher.getClientAccessToken({
    userId: "u1",
    tenantId: "tenant-demo",
    roomId: "r-ops"
  });

  const received = new Promise<EventEnvelope>((resolve, reject) => {
    const socket = new WebSocket(negotiation.url);

    socket.on("open", async () => {
      const event: EventEnvelope = {
        eventId: "evt-pass2-local",
        eventType: "MessageCreated",
        tenantId: "tenant-demo",
        occurredUtc: new Date().toISOString(),
        correlationId: "corr-pass2-local",
        threadId: "r-ops",
        roomId: "r-ops",
        actorUserId: "u2",
        entityId: "message-pass2-local",
        payload: { messageId: "message-pass2-local", content: "hello realtime" },
        version: 1,
        sequenceNumber: 1,
        idempotencyKey: "idempotency-pass2-local"
      };

      await publisher.publish(event);
    });

    socket.on("message", (value) => {
      const payload = JSON.parse(value.toString()) as { event: EventEnvelope };
      resolve(payload.event);
      socket.close();
    });

    socket.on("error", reject);
  });

  const delivered = await received;
  assert.equal(delivered.eventId, "evt-pass2-local");

  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});