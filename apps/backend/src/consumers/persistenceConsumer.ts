import type { EventEnvelope } from "../events/contracts.js";
import type { DataStore } from "../persistence/store.js";
import type { Message, TypingState } from "../types/domain.js";

export function createPersistenceConsumer(store: DataStore) {
  return async (event: EventEnvelope): Promise<void> => {
    await store.appendEvent(event);

    switch (event.eventType) {
      case "MessageCreated": {
        const payload = event.payload as {
          messageId: string;
          content: string;
          clientMessageId?: string;
        };
        const message: Message = {
          id: payload.messageId,
          tenantId: event.tenantId,
          threadId: event.threadId ?? event.roomId ?? "",
          roomId: event.roomId ?? "",
          senderId: event.actorUserId,
          content: payload.content,
          contentType: "text/plain",
          attachmentRefs: [],
          metadata: {},
          priority: "normal",
          createdUtc: event.occurredUtc,
          deleted: false,
          reactionSummary: {},
          readByUserIds: [event.actorUserId],
          sequenceNumber: event.sequenceNumber ?? 0,
          clientMessageId: payload.clientMessageId
        };
        await store.addMessage(message);
        break;
      }
      case "MessageRead": {
        const payload = event.payload as { messageId: string };
        await store.markRead(event.roomId ?? "", payload.messageId, event.actorUserId);
        break;
      }
      case "ReactionAdded": {
        const payload = event.payload as { messageId: string; reaction: string };
        await store.toggleReaction(event.roomId ?? "", payload.messageId, event.actorUserId, payload.reaction, true);
        break;
      }
      case "ReactionRemoved": {
        const payload = event.payload as { messageId: string; reaction: string };
        await store.toggleReaction(event.roomId ?? "", payload.messageId, event.actorUserId, payload.reaction, false);
        break;
      }
      case "TypingStarted": {
        const payload = event.payload as { expiresUtc: string };
        const typing: TypingState = {
          tenantId: event.tenantId,
          threadId: event.threadId ?? event.roomId ?? "",
          roomId: event.roomId ?? "",
          userId: event.actorUserId,
          expiresUtc: payload.expiresUtc
        };
        await store.setTyping(typing);
        break;
      }
      case "PresenceUpdated": {
        const payload = event.payload as { presence: "online" | "offline" | "away" };
        await store.setPresence(event.actorUserId, payload.presence);
        break;
      }
      case "RoomPinnedToggled": {
        const payload = event.payload as { pinned: boolean };
        await store.togglePin(event.roomId ?? "", event.actorUserId, payload.pinned);
        break;
      }
      default:
        break;
    }
  };
}
