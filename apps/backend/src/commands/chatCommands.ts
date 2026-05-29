import { v4 as uuidv4 } from "uuid";
import { createEvent } from "../events/eventFactory.js";
import type { EventEnvelope } from "../events/contracts.js";
import type { DataStore } from "../persistence/store.js";

export class ChatCommands {
  constructor(private readonly store: DataStore) {}

  async createMessage(input: {
    roomId: string;
    actorUserId: string;
    content: string;
    clientMessageId?: string;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const accepted = await this.store.rememberIdempotency(input.idempotencyKey, "pending");
    if (!accepted) {
      return null;
    }

    const sequenceNumber = await this.store.nextSequence(input.roomId);
    return createEvent({
      eventType: "MessageCreated",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: uuidv4(),
      payload: {
        messageId: uuidv4(),
        content: input.content,
        clientMessageId: input.clientMessageId
      },
      sequenceNumber,
      idempotencyKey: input.idempotencyKey
    });
  }

  async createRead(input: {
    roomId: string;
    actorUserId: string;
    messageId: string;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const accepted = await this.store.rememberIdempotency(input.idempotencyKey, "pending");
    if (!accepted) {
      return null;
    }
    const sequenceNumber = await this.store.nextSequence(input.roomId);
    return createEvent({
      eventType: "MessageRead",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: {
        messageId: input.messageId
      },
      sequenceNumber,
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
    const accepted = await this.store.rememberIdempotency(input.idempotencyKey, "pending");
    if (!accepted) {
      return null;
    }
    const sequenceNumber = await this.store.nextSequence(input.roomId);
    return createEvent({
      eventType: input.add ? "ReactionAdded" : "ReactionRemoved",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.messageId,
      payload: {
        messageId: input.messageId,
        reaction: input.reaction
      },
      sequenceNumber,
      idempotencyKey: input.idempotencyKey
    });
  }

  async createTyping(input: {
    roomId: string;
    actorUserId: string;
    started: boolean;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const accepted = await this.store.rememberIdempotency(input.idempotencyKey, "pending");
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
    const accepted = await this.store.rememberIdempotency(input.idempotencyKey, "pending");
    if (!accepted) {
      return null;
    }
    return createEvent({
      eventType: "PresenceUpdated",
      roomId: null,
      actorUserId: input.actorUserId,
      entityId: input.actorUserId,
      payload: {
        presence: input.presence
      },
      sequenceNumber: null,
      idempotencyKey: input.idempotencyKey
    });
  }

  async createPinToggle(input: {
    roomId: string;
    actorUserId: string;
    pinned: boolean;
    idempotencyKey: string;
  }): Promise<EventEnvelope | null> {
    const accepted = await this.store.rememberIdempotency(input.idempotencyKey, "pending");
    if (!accepted) {
      return null;
    }
    const sequenceNumber = await this.store.nextSequence(input.roomId);
    return createEvent({
      eventType: "RoomPinnedToggled",
      roomId: input.roomId,
      actorUserId: input.actorUserId,
      entityId: input.roomId,
      payload: {
        pinned: input.pinned
      },
      sequenceNumber,
      idempotencyKey: input.idempotencyKey
    });
  }
}
