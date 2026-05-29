export interface User {
  id: string;
  tenantId?: string;
  displayName: string;
  roleNames?: string[];
  attributes?: {
    unit?: string;
    team?: string;
    location?: string;
    shift?: string;
  };
  presence: "online" | "offline" | "away";
  lastSeenUtc: string;
}

export interface LinkedContext {
  type: string;
  contextId: string;
  label: string;
  metadata: Record<string, unknown>;
}

export interface ThreadPreference {
  userId: string;
  threadId: string;
  pinned: boolean;
  archived: boolean;
  hidden: boolean;
  muted: boolean;
  markUnread: boolean;
  followUpFlag: boolean;
}

export interface NotificationPreference {
  userId: string;
  tenantId: string;
  threadId?: string;
  muted: boolean;
  muteLowPriority: boolean;
  allowPriorityOverride: boolean;
}

export interface QuickMessageTemplate {
  id: string;
  tenantId: string;
  scopeType: "tenant" | "site" | "unit" | "department" | "team";
  scopeId: string;
  title: string;
  body: string;
  active: boolean;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  actorUserId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  occurredUtc: string;
  payload: Record<string, unknown>;
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
  editedUtc?: string;
  deleted: boolean;
  reactionSummary: Record<string, string[]>;
  deliveredToUserIds?: string[];
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
  createdByUserId?: string;
  createdUtc: string;
  lastActivityUtc?: string;
  linkedContext?: LinkedContext;
  pinnedByUserIds: string[];
  metadata?: Record<string, unknown>;
  summary: {
    threadId?: string;
    roomId: string;
    tenantId?: string;
    lastMessagePreview: string;
    unreadCountByUser: Record<string, number>;
    lastActivityUtc: string;
    linkedContext?: LinkedContext;
  };
}

export interface RoomDetails extends Room {
  preference: ThreadPreference;
  notificationPreference: NotificationPreference;
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
