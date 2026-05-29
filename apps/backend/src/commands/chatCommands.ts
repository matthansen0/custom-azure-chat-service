import { v4 as uuidv4 } from "uuid";
import { createEvent } from "../events/eventFactory.js";
import type { EventEnvelope } from "../events/contracts.js";
import type { DataStore } from "../persistence/store.js";
import type { LinkedContext, NotificationPreference, QuickMessageTemplate, Room } from "../types/domain.js";

export class ChatCommands {
  constructor(private readonly store: DataStore) {}

  private async reserveIdempotency(key: string): Promise<boolean> {
    return this.store.rememberIdempotency(key, "pending");
  }

  private async createRoomScopedEvent(input: {
    eventType: EventEnvelope["eventType"];
    roomId: string;
    actorUserId: string;
    entityId: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const accepted = await this.reserveIdempotency(input.idempotencyKey);
    if (!accepted) {
      return null;
    }
    const sequenceNumber = await this.store.nextSequence(input.roomId);
    return createEvent({
      eventType: input.eventType,
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.entityId,
      payload: input.payload,
      sequenceNumber,
      idempotencyKey: input.idempotencyKey
    });
  }

  private async createGlobalEvent(input: {
    eventType: EventEnvelope["eventType"];
    actorUserId: string;
    entityId: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const accepted = await this.reserveIdempotency(input.idempotencyKey);
    if (!accepted) {
      return null;
    }
    return createEvent({
      eventType: input.eventType,
      roomId: null,
      actorUserId: input.actorUserId,
      entityId: input.entityId,
      payload: input.payload,
      sequenceNumber: null,
      idempotencyKey: input.idempotencyKey
    });
  }

  async createMessage(input: {
    roomId: string;
    actorUserId: string;
    content: string;
    clientMessageId?: string;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const messageId = uuidv4();
    return this.createRoomScopedEvent({
      eventType: "MessageCreated",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: messageId,
      payload: {
        messageId,
        content: input.content,
        clientMessageId: input.clientMessageId
      },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createRead(input: {
    roomId: string;
    actorUserId: string;
    messageId: string;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "MessageRead",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: {
        messageId: input.messageId
      },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createReaction(input: {
    roomId: string;
    actorUserId: string;
    messageId: string;
    reaction: string;
    add: boolean;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: input.add ? "ReactionAdded" : "ReactionRemoved",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: {
        messageId: input.messageId,
        reaction: input.reaction
      },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createTyping(input: {
    roomId: string;
    actorUserId: string;
    started: boolean;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const accepted = await this.reserveIdempotency(input.idempotencyKey);
    if (!accepted) {
      return null;
    }
    return createEvent({
      eventType: input.started ? "TypingStarted" : "TypingStopped",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: `${input.roomId}:${input.actorUserId}`,
      payload: {
        expiresUtc: new Date(Date.now() + 5000).toISOString()
      },
      sequenceNumber: null,
      idempotencyKey: input.idempotencyKey
    });
  }

  async createPresence(input: {
    actorUserId: string;
    presence: "online" | "offline" | "away";
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createGlobalEvent({
      eventType: "PresenceUpdated",
      actorUserId: input.actorUserId,
      entityId: input.actorUserId,
      payload: {
        presence: input.presence
      },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createPinToggle(input: {
    roomId: string;
    actorUserId: string;
    pinned: boolean;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "RoomPinnedToggled",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: {
        pinned: input.pinned
      },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createMessageEdit(input: {
    roomId: string;
    actorUserId: string;
    messageId: string;
    content: string;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "MessageEdited",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: { messageId: input.messageId, content: input.content },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createMessageDelete(input: {
    roomId: string;
    actorUserId: string;
    messageId: string;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "MessageDeleted",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: { messageId: input.messageId },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createMessageDelivered(input: {
    roomId: string;
    actorUserId: string;
    messageId: string;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "MessageDelivered",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: { messageId: input.messageId },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createMessagePriority(input: {
    roomId: string;
    actorUserId: string;
    messageId: string;
    priority: "low" | "normal" | "high" | "urgent";
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "MessagePrioritySet",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: { messageId: input.messageId, priority: input.priority },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createThread(input: {
    actorUserId: string;
    name: string;
    type: Room["type"];
    participantIds: string[];
    linkedContext?: LinkedContext;
    metadata?: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const roomId = `r-${uuidv4().slice(0, 8)}`;
    return this.createGlobalEvent({
      eventType: "ThreadCreated",
      actorUserId: input.actorUserId,
      entityId: roomId,
      payload: {
        roomId,
        name: input.name,
        type: input.type,
        participantIds: input.participantIds,
        linkedContext: input.linkedContext,
        metadata: input.metadata ?? {}
      },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createThreadDelete(input: { roomId: string; actorUserId: string; idempotencyKey: string }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "ThreadDeleted",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: { roomId: input.roomId },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createThreadClear(input: { roomId: string; actorUserId: string; idempotencyKey: string }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "ThreadCleared",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: { roomId: input.roomId },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createParticipantAdd(input: {
    roomId: string;
    actorUserId: string;
    participantIds: string[];
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "ParticipantAdded",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: { participantIds: input.participantIds },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createParticipantRemove(input: {
    roomId: string;
    actorUserId: string;
    participantId: string;
    left?: boolean;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: input.left ? "ParticipantLeft" : "ParticipantRemoved",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.participantId,
      payload: { participantId: input.participantId },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createThreadPreferenceEvent(input: {
    roomId: string;
    actorUserId: string;
    eventType: "ThreadArchived" | "ThreadRemovedFromList" | "ThreadMarkedUnread" | "FollowUpFlagSet";
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: input.eventType,
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey
    });
  }

  async createNotificationPreferenceChange(input: {
    roomId?: string;
    actorUserId: string;
    preference: Pick<NotificationPreference, "muted" | "muteLowPriority" | "allowPriorityOverride">;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    if (input.roomId) {
      return this.createRoomScopedEvent({
        eventType: "NotificationPreferenceChanged",
        roomId: input.roomId,
        actorUserId: input.actorUserId,
        entityId: input.roomId,
        payload: {
          threadId: input.roomId,
          ...input.preference
        },
        idempotencyKey: input.idempotencyKey
      });
    }
    return this.createGlobalEvent({
      eventType: "NotificationPreferenceChanged",
      actorUserId: input.actorUserId,
      entityId: input.roomId ?? input.actorUserId,
      payload: {
        threadId: input.roomId,
        ...input.preference
      },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createTemplateEvent(input: {
    actorUserId: string;
    eventType: "QuickMessageTemplateCreated" | "QuickMessageTemplateUpdated";
    template: Omit<QuickMessageTemplate, "id"> & { id?: string };
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createGlobalEvent({
      eventType: input.eventType,
      actorUserId: input.actorUserId,
      entityId: input.template.id ?? `tmpl-${uuidv4().slice(0, 8)}`,
      payload: input.template,
      idempotencyKey: input.idempotencyKey
    });
  }

  async createContextLink(input: {
    roomId: string;
    actorUserId: string;
    linkedContext: LinkedContext;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "ContextLinkedToThread",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: { linkedContext: input.linkedContext },
      idempotencyKey: input.idempotencyKey
    });
  }

  async createAssignmentMembershipUpdate(input: {
    roomId: string;
    actorUserId: string;
    participantIds: string[];
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    return this.createRoomScopedEvent({
      eventType: "AssignmentMembershipUpdated",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: { participantIds: input.participantIds },
      idempotencyKey: input.idempotencyKey
    });
  }
}
