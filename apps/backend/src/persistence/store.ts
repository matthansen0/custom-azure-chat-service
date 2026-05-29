import { CosmosClient, type Container } from "@azure/cosmos";
import type { EventEnvelope } from "../events/contracts.js";
import type { Message, PresenceState, Room, RoomSummary, TypingState, User } from "../types/domain.js";

const demoTenantId = "tenant-demo";

export interface DataStore {
  ensureSeedData(): Promise<void>;
  nextSequence(roomId: string): Promise<number>;
  rememberIdempotency(key: string, eventId: string): Promise<boolean>;
  appendEvent(event: EventEnvelope): Promise<void>;
  addMessage(message: Message): Promise<void>;
  markRead(roomId: string, messageId: string, userId: string): Promise<void>;
  toggleReaction(roomId: string, messageId: string, userId: string, reaction: string, add: boolean): Promise<void>;
  setTyping(state: TypingState | null): Promise<void>;
  setPresence(userId: string, presence: PresenceState): Promise<void>;
  togglePin(roomId: string, userId: string, pinned: boolean): Promise<void>;
  listRooms(userId: string): Promise<Array<Room & { summary: RoomSummary }>>;
  listRoomMembers(roomId: string): Promise<User[]>;
  listMessages(roomId: string, take: number): Promise<Message[]>;
  searchMessages(roomId: string, query: string): Promise<Message[]>;
}

type MemoryState = {
  rooms: Room[];
  users: User[];
  messages: Message[];
  summaries: RoomSummary[];
  typing: TypingState[];
  processedKeys: Map<string, string>;
  sequenceByRoom: Map<string, number>;
};

export class MemoryStore implements DataStore {
  private state: MemoryState = {
    rooms: [],
    users: [],
    messages: [],
    summaries: [],
    typing: [],
    processedKeys: new Map<string, string>(),
    sequenceByRoom: new Map<string, number>()
  };

  async ensureSeedData(): Promise<void> {
    if (this.state.rooms.length > 0) {
      return;
    }

    const now = new Date().toISOString();
    this.state.users = [
      {
        id: "u1",
        tenantId: demoTenantId,
        displayName: "Alex",
        roleNames: ["dispatcher"],
        attributes: { unit: "ops", team: "alpha", location: "hq", shift: "day" },
        presence: "online",
        lastSeenUtc: now
      },
      {
        id: "u2",
        tenantId: demoTenantId,
        displayName: "Jordan",
        roleNames: ["responder"],
        attributes: { unit: "ops", team: "alpha", location: "hq", shift: "swing" },
        presence: "online",
        lastSeenUtc: now
      },
      {
        id: "u3",
        tenantId: demoTenantId,
        displayName: "Sam",
        roleNames: ["supervisor"],
        attributes: { unit: "ops", team: "lead", location: "remote", shift: "night" },
        presence: "away",
        lastSeenUtc: now
      }
    ];

    this.state.rooms = [
      {
        id: "r-ops",
        tenantId: demoTenantId,
        name: "Operations",
        type: "group",
        participantIds: ["u1", "u2", "u3"],
        createdUtc: now,
        lastActivityUtc: now,
        metadata: {},
        pinnedByUserIds: []
      },
      {
        id: "r-direct-u1-u2",
        tenantId: demoTenantId,
        name: "Alex and Jordan",
        type: "direct",
        participantIds: ["u1", "u2"],
        createdUtc: now,
        lastActivityUtc: now,
        metadata: {},
        pinnedByUserIds: []
      }
    ];

    this.state.summaries = this.state.rooms.map((room) => ({
      threadId: room.id,
      roomId: room.id,
      tenantId: room.tenantId,
      lastMessagePreview: "",
      unreadCountByUser: {},
      lastActivityUtc: room.createdUtc,
      participantSummary: this.state.users
        .filter((user) => room.participantIds.includes(user.id))
        .map((user) => ({ id: user.id, displayName: user.displayName, presence: user.presence })),
      securityBindings: {
        tenantId: room.tenantId,
        visibleToUserIds: [...room.participantIds]
      }
    }));
  }

  async nextSequence(roomId: string): Promise<number> {
    const next = (this.state.sequenceByRoom.get(roomId) ?? 0) + 1;
    this.state.sequenceByRoom.set(roomId, next);
    return next;
  }

  async rememberIdempotency(key: string, eventId: string): Promise<boolean> {
    if (this.state.processedKeys.has(key)) {
      return false;
    }
    this.state.processedKeys.set(key, eventId);
    return true;
  }

  async appendEvent(_event: EventEnvelope): Promise<void> {
    return;
  }

  async addMessage(message: Message): Promise<void> {
    this.state.messages.push(message);
    const summary = this.state.summaries.find((value) => value.roomId === message.roomId);
    if (summary) {
      summary.lastMessagePreview = message.content;
      summary.lastActivityUtc = message.createdUtc;
      const room = this.state.rooms.find((value) => value.id === message.roomId);
      if (room) {
        for (const participantId of room.participantIds) {
          if (participantId !== message.senderId) {
            summary.unreadCountByUser[participantId] = (summary.unreadCountByUser[participantId] ?? 0) + 1;
          }
        }
      }
    }

    const room = this.state.rooms.find((value) => value.id === message.roomId);
    if (room) {
      room.lastActivityUtc = message.createdUtc;
    }
  }

  async markRead(roomId: string, messageId: string, userId: string): Promise<void> {
    const message = this.state.messages.find((value) => value.roomId === roomId && value.id === messageId);
    if (message && !message.readByUserIds.includes(userId)) {
      message.readByUserIds.push(userId);
      const summary = this.state.summaries.find((value) => value.roomId === roomId);
      if (summary) {
        summary.unreadCountByUser[userId] = Math.max(0, (summary.unreadCountByUser[userId] ?? 0) - 1);
      }
    }
  }

  async toggleReaction(roomId: string, messageId: string, userId: string, reaction: string, add: boolean): Promise<void> {
    const message = this.state.messages.find((value) => value.roomId === roomId && value.id === messageId);
    if (!message) {
      return;
    }
    const users = new Set(message.reactionSummary[reaction] ?? []);
    if (add) {
      users.add(userId);
    } else {
      users.delete(userId);
    }
    message.reactionSummary[reaction] = Array.from(users);
  }

  async setTyping(state: TypingState | null): Promise<void> {
    if (!state) {
      return;
    }

    this.state.typing = this.state.typing.filter(
      (value) => !(value.roomId === state.roomId && value.userId === state.userId)
    );
    this.state.typing.push(state);
  }

  async setPresence(userId: string, presence: PresenceState): Promise<void> {
    const user = this.state.users.find((value) => value.id === userId);
    if (user) {
      user.presence = presence;
      user.lastSeenUtc = new Date().toISOString();
    }
  }

  async togglePin(roomId: string, userId: string, pinned: boolean): Promise<void> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return;
    }
    const set = new Set(room.pinnedByUserIds);
    if (pinned) {
      set.add(userId);
    } else {
      set.delete(userId);
    }
    room.pinnedByUserIds = Array.from(set);
  }

  async listRooms(userId: string): Promise<Array<Room & { summary: RoomSummary }>> {
    return this.state.rooms
      .filter((value) => value.participantIds.includes(userId))
      .map((room) => ({
        ...room,
        summary:
          this.state.summaries.find((value) => value.roomId === room.id) ?? {
            threadId: room.id,
            roomId: room.id,
            tenantId: room.tenantId,
            lastMessagePreview: "",
            unreadCountByUser: {},
            lastActivityUtc: room.createdUtc,
            participantSummary: this.state.users
              .filter((user) => room.participantIds.includes(user.id))
              .map((user) => ({ id: user.id, displayName: user.displayName, presence: user.presence })),
            securityBindings: {
              tenantId: room.tenantId,
              visibleToUserIds: [...room.participantIds]
            }
          }
      }))
      .sort((left, right) => {
        const leftPinned = left.pinnedByUserIds.includes(userId) ? 1 : 0;
        const rightPinned = right.pinnedByUserIds.includes(userId) ? 1 : 0;
        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }
        return right.summary.lastActivityUtc.localeCompare(left.summary.lastActivityUtc);
      });
  }

  async listRoomMembers(roomId: string): Promise<User[]> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return [];
    }
    return this.state.users.filter((value) => room.participantIds.includes(value.id));
  }

  async listMessages(roomId: string, take: number): Promise<Message[]> {
    return this.state.messages
      .filter((value) => value.roomId === roomId)
      .sort((left, right) => right.sequenceNumber - left.sequenceNumber)
      .slice(0, take)
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber);
  }

  async searchMessages(roomId: string, query: string): Promise<Message[]> {
    const normalized = query.toLowerCase();
    return this.state.messages.filter(
      (value) => value.roomId === roomId && value.content.toLowerCase().includes(normalized)
    );
  }
}

// CosmosStore is intentionally light for this prototype and falls back to memory for read models.
export class CosmosStore extends MemoryStore {
  private readonly client: CosmosClient;
  private readonly eventsContainer: Container;

  constructor(connection: { endpoint: string; key: string; database: string; eventsContainer: string }) {
    super();
    this.client = new CosmosClient({ endpoint: connection.endpoint, key: connection.key });
    this.eventsContainer = this.client.database(connection.database).container(connection.eventsContainer);
  }

  override async appendEvent(event: EventEnvelope): Promise<void> {
    await this.eventsContainer.items.create({ id: event.eventId, partitionKey: event.roomId ?? "global", ...event });
  }
}
