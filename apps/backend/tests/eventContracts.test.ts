import assert from "node:assert/strict";
import test from "node:test";
import { eventEnvelopeSchema } from "../src/events/contracts.js";

const event = {
  eventId: "event-1",
  eventType: "MessageCreated",
  tenantId: "tenant-demo",
  occurredUtc: "2026-01-01T00:00:00.000Z",
  correlationId: "correlation-1",
  threadId: null,
  roomId: null,
  actorUserId: "u1",
  entityId: "message-1",
  version: 1,
  sequenceNumber: null,
  idempotencyKey: "event-1"
};

test("event payloads preserve arbitrary string-keyed values", () => {
  const payload = {
    text: "hello",
    count: 2,
    nested: { enabled: true },
    items: ["one", 2],
    empty: null
  };

  assert.deepEqual(eventEnvelopeSchema.parse({ ...event, payload }).payload, payload);
  assert.deepEqual(eventEnvelopeSchema.parse({ ...event, payload: {} }).payload, {});
});

test("event payloads reject values that are not records", () => {
  for (const payload of [null, [], "invalid", 42, undefined]) {
    assert.equal(eventEnvelopeSchema.safeParse({ ...event, payload }).success, false);
  }
});
