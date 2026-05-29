export interface User {
  id: string;
  tenantId?: string;
  displayName: string;
  presence: "online" | "offline" | "away";
  lastSeenUtc: string;
}

export interface Message {
  id: string;
  tenantId?: string;
  threadId?: string;
  roomId: string;
  senderId: string;
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
  priority?: string;
  createdUtc: string;
  deleted: boolean;
  reactionSummary: Record<string, string[]>;
  readByUserIds: string[];
  sequenceNumber: number;
  clientMessageId?: string;
}

export interface Room {
  id: string;
  tenantId?: string;
  name: string;
  type: "direct" | "group" | "system" | "announcement";
  participantIds: string[];
  createdUtc: string;
  lastActivityUtc?: string;
  pinnedByUserIds: string[];
  metadata?: Record<string, unknown>;
  summary: {
    threadId?: string;
    roomId: string;
    tenantId?: string;
    lastMessagePreview: string;
    unreadCountByUser: Record<string, number>;
    lastActivityUtc: string;
  };
}

export interface EventEnvelope {
  eventId: string;
  eventType:
    | "ThreadCreated"
    | "ThreadDeleted"
    | "ThreadCleared"
    | "ParticipantAdded"
    | "ParticipantRemoved"
    | "ParticipantLeft"
    | "MessageCreated"
    | "MessageEdited"
    | "MessageDeleted"
    | "MessageRead"
    | "MessageDelivered"
    | "MessagePrioritySet"
    | "ReactionAdded"
    | "ReactionRemoved"
    | "TypingStarted"
    | "TypingStopped"
    | "PresenceUpdated"
    | "ThreadPinned"
    | "ThreadUnpinned"
    | "ThreadMarkedUnread"
    | "ThreadArchived"
    | "ThreadRemovedFromList"
    | "FollowUpFlagSet"
    | "QuickMessageTemplateCreated"
    | "QuickMessageTemplateUpdated"
    | "ContextLinkedToThread"
    | "AssignmentMembershipUpdated"
    | "NotificationPreferenceChanged"
    | "AuditEventRecorded"
    | "RoomCreated"
    | "RoomMembershipChanged"
    | "RoomPinnedToggled"
    | "SearchProjectionUpdated";
  tenantId: string;
  occurredUtc: string;
  correlationId: string;
  threadId: string | null;
  roomId: string | null;
  actorUserId: string;
  entityId: string;
  payload: Record<string, unknown>;
  version: number;
  sequenceNumber: number | null;
  idempotencyKey: string;
}

export interface RealtimeNegotiation {
  kind: "webpubsub" | "local";
  url: string;
}
