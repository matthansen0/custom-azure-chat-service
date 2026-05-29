import { z } from "zod";

export const eventTypeSchema = z.enum([
  "ThreadCreated",
  "ThreadDeleted",
  "ThreadCleared",
  "ParticipantAdded",
  "ParticipantRemoved",
  "ParticipantLeft",
  "MessageCreated",
  "MessageEdited",
  "MessageDeleted",
  "MessageRead",
  "MessageDelivered",
  "MessagePrioritySet",
  "ReactionAdded",
  "ReactionRemoved",
  "TypingStarted",
  "TypingStopped",
  "PresenceUpdated",
  "ThreadPinned",
  "ThreadUnpinned",
  "ThreadMarkedUnread",
  "ThreadArchived",
  "ThreadRemovedFromList",
  "FollowUpFlagSet",
  "QuickMessageTemplateCreated",
  "QuickMessageTemplateUpdated",
  "ContextLinkedToThread",
  "AssignmentMembershipUpdated",
  "NotificationPreferenceChanged",
  "SearchProjectionUpdated",
  "AuditEventRecorded",
  "RoomCreated",
  "RoomMembershipChanged",
  "RoomPinnedToggled"
]);

export type EventType = z.infer<typeof eventTypeSchema>;

export const eventEnvelopeSchema = z.object({
  eventId: z.string(),
  eventType: eventTypeSchema,
  tenantId: z.string(),
  occurredUtc: z.string(),
  correlationId: z.string(),
  threadId: z.string().nullable(),
  roomId: z.string().nullable(),
  actorUserId: z.string(),
  entityId: z.string(),
  payload: z.record(z.any()),
  version: z.number().int().positive(),
  sequenceNumber: z.number().int().nonnegative().nullable(),
  idempotencyKey: z.string()
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
