export type PresenceState = "online" | "offline" | "away";
export type ThreadType = "direct" | "group" | "system" | "announcement";
export type RoomType = ThreadType;

export interface UserAttributes {
  unit?: string;
  team?: string;
  location?: string;
  shift?: string;
  [key: string]: string | undefined;
}

export interface User {
  id: string;
  tenantId: string;
  displayName: string;
  roleNames: string[];
  attributes: UserAttributes;
  presence: PresenceState;
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
  customSortOrder?: number;
}

export interface Thread {
  id: string;
  tenantId: string;
  name: string;
  type: ThreadType;
  participantIds: string[];
  createdUtc: string;
  lastActivityUtc: string;
  linkedContext?: LinkedContext;
  metadata: Record<string, unknown>;
  pinnedByUserIds: string[];
}

export type Room = Thread;

export interface AttachmentRef {
  id: string;
  mediaType: string;
  fileName: string;
  url: string;
  scanStatus: "pending" | "clean" | "blocked";
}

export interface Message {
  id: string;
  tenantId: string;
  threadId: string;
  roomId: string;
  senderId: string;
  content: string;
  contentType: "text/plain" | "text/markdown" | "system";
  attachmentRefs: AttachmentRef[];
  metadata: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "urgent";
  createdUtc: string;
  editedUtc?: string;
  deleted: boolean;
  reactionSummary: Record<string, string[]>;
  readByUserIds: string[];
  sequenceNumber: number;
  clientMessageId?: string;
}

export interface ThreadParticipation {
  threadId: string;
  userId: string;
  roleInThread: "member" | "owner" | "moderator";
  joinedUtc: string;
  leftUtc?: string;
  historyVisibleFromUtc: string;
}

export type RoomMembership = ThreadParticipation;

export interface Reaction {
  tenantId: string;
  threadId: string;
  messageId: string;
  userId: string;
  reactionType: string;
  createdUtc: string;
}

export interface ReadReceipt {
  tenantId: string;
  threadId: string;
  messageId: string;
  userId: string;
  readUtc: string;
}

export interface DeliveryReceipt {
  tenantId: string;
  threadId: string;
  messageId: string;
  userId: string;
  deliveredUtc: string;
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

export interface ThreadSummary {
  threadId: string;
  roomId: string;
  tenantId: string;
  lastMessagePreview: string;
  unreadCountByUser: Record<string, number>;
  lastActivityUtc: string;
  participantSummary: Array<Pick<User, "id" | "displayName" | "presence">>;
  securityBindings: {
    tenantId: string;
    visibleToUserIds: string[];
  };
}

export type RoomSummary = ThreadSummary;

export interface SearchProjection {
  threadId: string;
  tenantId: string;
  indexedContent: string;
  lastMessagePreview: string;
  visibleToUserIds: string[];
  entries: Array<{
    messageId: string;
    indexedContent: string;
  }>;
}

export interface TypingState {
  tenantId: string;
  threadId: string;
  roomId: string;
  userId: string;
  expiresUtc: string;
}
