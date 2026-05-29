import { v4 as uuidv4 } from "uuid";
import type { EventEnvelope, EventType } from "./contracts.js";

export function createEvent(input: {
  eventType: EventType;
  tenantId?: string;
  correlationId?: string;
  threadId?: string | null;
  roomId: string | null;
  actorUserId: string;
  entityId: string;
  payload: Record<string, unknown>;
  sequenceNumber: number | null;
  idempotencyKey: string;
}): EventEnvelope {
  return {
    eventId: uuidv4(),
    eventType: input.eventType,
    tenantId: input.tenantId ?? "tenant-demo",
    occurredUtc: new Date().toISOString(),
    correlationId: input.correlationId ?? uuidv4(),
    threadId: input.threadId ?? input.roomId,
    roomId: input.roomId,
    actorUserId: input.actorUserId,
    entityId: input.entityId,
    payload: input.payload,
    version: 1,
    sequenceNumber: input.sequenceNumber,
    idempotencyKey: input.idempotencyKey
  };
}
