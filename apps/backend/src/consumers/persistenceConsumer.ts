import type { EventEnvelope } from "../events/contracts.js";
import type { DataStore } from "../persistence/store.js";
import type { LinkedContext, Message, QuickMessageTemplate, Room, TypingState } from "../types/domain.js";

export function createPersistenceConsumer(store: DataStore) {
  return async (event: EventEnvelope): Promise<void> => {
    await store.appendEvent(event);

    switch (event.eventType) {
      case "ThreadCreated": {
        const payload = event.payload as {
          roomId: string;
          name: string;
          type: Room["type"];
          participantIds: string[];
          linkedContext?: LinkedContext;
          metadata?: Record<string, unknown>;
        };
        await store.createRoom({
          id: payload.roomId,
          actorUserId: event.actorUserId,
          name: payload.name,
          type: payload.type,
          participantIds: payload.participantIds,
          linkedContext: payload.linkedContext,
          metadata: payload.metadata
        });
        break;
      }
      case "ThreadDeleted": {
        await store.deleteRoom(event.roomId ?? "");
        break;
      }
      case "ThreadCleared": {
        await store.clearRoom(event.roomId ?? "");
        break;
      }
      case "ParticipantAdded": {
        const payload = event.payload as { participantIds: string[] };
        await store.addParticipants(event.roomId ?? "", payload.participantIds);
        break;
      }
      case "ParticipantRemoved": {
        const payload = event.payload as { participantId: string };
        await store.removeParticipant(event.roomId ?? "", payload.participantId);
        break;
      }
      case "ParticipantLeft": {
        const payload = event.payload as { participantId: string };
        await store.leaveRoom(event.roomId ?? "", payload.participantId);
        break;
      }
      case "MessageCreated": {
        const payload = event.payload as {
          messageId: string;
          content: string;
          clientMessageId?: string;
          mentions?: string[];
          mentionEveryone?: boolean;
          priority?: Message["priority"];
          replyToMessageId?: string;
        };
        const mentions = Array.isArray(payload.mentions) ? payload.mentions : [];
        const mentionEveryone = Boolean(payload.mentionEveryone);
        const priority: Message["priority"] = payload.priority ?? "normal";
        const replyToMessageId = typeof payload.replyToMessageId === "string" ? payload.replyToMessageId : undefined;
        let replyTo: { messageId: string; senderId: string; content: string } | undefined;
        if (replyToMessageId) {
          const original = await store.getMessage(event.roomId ?? "", replyToMessageId);
          if (original) {
            replyTo = {
              messageId: original.id,
              senderId: original.senderId,
              content: original.content
            };
          } else {
            replyTo = { messageId: replyToMessageId, senderId: "", content: "" };
          }
        }
        const message: Message = {
          id: payload.messageId,
          tenantId: event.tenantId,
          threadId: event.threadId ?? event.roomId ?? "",
          roomId: event.roomId ?? "",
          senderId: event.actorUserId,
          content: payload.content,
          contentType: "text/plain",
          attachmentRefs: [],
          metadata: { mentions, mentionEveryone, ...(replyTo ? { replyTo } : {}) },
          priority,
          createdUtc: event.occurredUtc,
          deleted: false,
          reactionSummary: {},
          deliveredToUserIds: [event.actorUserId],
          readByUserIds: [event.actorUserId],
          sequenceNumber: event.sequenceNumber ?? 0,
          clientMessageId: payload.clientMessageId
        };
        await store.addMessage(message);
        break;
      }
      case "MessageEdited": {
        const payload = event.payload as { messageId: string; content: string };
        await store.updateMessage(event.roomId ?? "", payload.messageId, { content: payload.content });
        break;
      }
      case "MessageDeleted": {
        const payload = event.payload as { messageId: string };
        await store.deleteMessage(event.roomId ?? "", payload.messageId);
        break;
      }
      case "MessageRead": {
        const payload = event.payload as { messageId: string };
        await store.markRead(event.roomId ?? "", payload.messageId, event.actorUserId);
        break;
      }
      case "MessageDelivered": {
        const payload = event.payload as { messageId: string };
        await store.markDelivered(event.roomId ?? "", payload.messageId, event.actorUserId);
        break;
      }
      case "MessagePrioritySet": {
        const payload = event.payload as { messageId: string; priority: Message["priority"] };
        await store.updateMessage(event.roomId ?? "", payload.messageId, { priority: payload.priority });
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
      case "ThreadArchived": {
        const payload = event.payload as { archived: boolean };
        await store.upsertThreadPreference(event.actorUserId, event.roomId ?? "", { archived: payload.archived });
        break;
      }
      case "ThreadRemovedFromList": {
        const payload = event.payload as { hidden: boolean };
        await store.upsertThreadPreference(event.actorUserId, event.roomId ?? "", { hidden: payload.hidden });
        break;
      }
      case "ThreadMarkedUnread": {
        const payload = event.payload as { markUnread: boolean };
        await store.upsertThreadPreference(event.actorUserId, event.roomId ?? "", { markUnread: payload.markUnread });
        break;
      }
      case "FollowUpFlagSet": {
        const payload = event.payload as { followUpFlag: boolean };
        await store.upsertThreadPreference(event.actorUserId, event.roomId ?? "", { followUpFlag: payload.followUpFlag });
        break;
      }
      case "NotificationPreferenceChanged": {
        const payload = event.payload as {
          threadId?: string;
          muted: boolean;
          muteLowPriority: boolean;
          allowPriorityOverride: boolean;
        };
        await store.upsertNotificationPreference(event.actorUserId, {
          tenantId: event.tenantId,
          threadId: payload.threadId,
          muted: payload.muted,
          muteLowPriority: payload.muteLowPriority,
          allowPriorityOverride: payload.allowPriorityOverride
        });
        break;
      }
      case "QuickMessageTemplateCreated":
      case "QuickMessageTemplateUpdated": {
        const payload = event.payload as Omit<QuickMessageTemplate, "id"> & { id?: string };
        await store.upsertQuickTemplate({ ...payload, id: event.entityId, tenantId: event.tenantId });
        break;
      }
      case "ContextLinkedToThread": {
        const payload = event.payload as { linkedContext: LinkedContext };
        await store.linkContext(event.roomId ?? "", payload.linkedContext);
        break;
      }
      case "AssignmentMembershipUpdated": {
        const payload = event.payload as { participantIds: string[] };
        await store.updateAssignmentMembership(event.roomId ?? "", payload.participantIds);
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

    if (!["TypingStarted", "TypingStopped", "PresenceUpdated", "SearchProjectionUpdated"].includes(event.eventType)) {
      const payloadThreadId = typeof event.payload.roomId === "string" ? event.payload.roomId : undefined;
      await store.appendAuditEvent({
        tenantId: event.tenantId,
        actorUserId: event.actorUserId,
        eventType: event.eventType,
        entityType: event.roomId ? "thread" : "platform",
        entityId: event.entityId,
        payload: {
          threadId: event.roomId ?? event.threadId ?? payloadThreadId,
          eventId: event.eventId,
          payload: event.payload
        }
      });
    }
  };
}
