import { CosmosClient, type Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import type { EventEnvelope } from "../events/contracts.js";
import type {
  AuditEvent,
  LinkedContext,
  Message,
  NotificationPreference,
  PresenceState,
  QuickMessageTemplate,
  Room,
  RoomSummary,
  SearchProjection,
  ThreadPreference,
  TypingState,
  User
} from "../types/domain.js";

const demoTenantId = "tenant-demo";

export interface DataStore {
  ensureSeedData(): Promise<void>;
  nextSequence(roomId: string): Promise<number>;
  rememberIdempotency(key: string, eventId: string): Promise<boolean>;
  appendEvent(event: EventEnvelope): Promise<void>;
  addMessage(message: Message): Promise<void>;
  getMessage(roomId: string, messageId: string): Promise<Message | null>;
  updateMessage(roomId: string, messageId: string, input: { content?: string; priority?: Message["priority"] }): Promise<Message | null>;
  deleteMessage(roomId: string, messageId: string): Promise<Message | null>;
  markRead(roomId: string, messageId: string, userId: string): Promise<void>;
  markDelivered(roomId: string, messageId: string, userId: string): Promise<void>;
  toggleReaction(roomId: string, messageId: string, userId: string, reaction: string, add: boolean): Promise<void>;
  setTyping(state: TypingState | null): Promise<void>;
  setPresence(userId: string, presence: PresenceState): Promise<void>;
  togglePin(roomId: string, userId: string, pinned: boolean): Promise<void>;
  upsertThreadPreference(userId: string, roomId: string, changes: Partial<Omit<ThreadPreference, "userId" | "threadId">>): Promise<ThreadPreference>;
  getThreadPreference(userId: string, roomId: string): Promise<ThreadPreference>;
  upsertNotificationPreference(userId: string, input: Omit<NotificationPreference, "userId" | "tenantId"> & { tenantId?: string }): Promise<NotificationPreference>;
  getNotificationPreference(userId: string, threadId?: string): Promise<NotificationPreference>;
  listRooms(userId: string, options?: { includeArchived?: boolean; includeHidden?: boolean }): Promise<Array<Room & { summary: RoomSummary }>>;
  getRoom(userId: string, roomId: string): Promise<(Room & { summary: RoomSummary; preference: ThreadPreference; notificationPreference: NotificationPreference }) | null>;
  hasRoomAccess(userId: string, roomId: string): Promise<boolean>;
  findRoomById(roomId: string): Promise<Room | null>;
  createRoom(input: {
    id?: string;
    actorUserId: string;
    name: string;
    type: Room["type"];
    participantIds: string[];
    linkedContext?: LinkedContext;
    metadata?: Record<string, unknown>;
  }): Promise<Room>;
  deleteRoom(roomId: string): Promise<Room | null>;
  clearRoom(roomId: string): Promise<void>;
  addParticipants(roomId: string, participantIds: string[]): Promise<Room | null>;
  removeParticipant(roomId: string, userId: string): Promise<Room | null>;
  leaveRoom(roomId: string, userId: string): Promise<Room | null>;
  linkContext(roomId: string, linkedContext: LinkedContext): Promise<Room | null>;
  updateAssignmentMembership(roomId: string, participantIds: string[]): Promise<Room | null>;
  listRoomMembers(roomId: string): Promise<User[]>;
  listMessages(roomId: string, take: number): Promise<Message[]>;
  rebuildSearchProjection(roomId: string): Promise<void>;
  searchMessages(roomId: string, query: string, userId: string): Promise<Message[]>;
  listQuickTemplates(userId: string, filters?: { scopeType?: QuickMessageTemplate["scopeType"]; scopeId?: string; query?: string }): Promise<QuickMessageTemplate[]>;
  upsertQuickTemplate(input: Omit<QuickMessageTemplate, "id"> & { id?: string }): Promise<QuickMessageTemplate>;
  searchDirectory(filters?: { query?: string; role?: string; team?: string; location?: string; shift?: string }): Promise<User[]>;
  appendAuditEvent(event: Omit<AuditEvent, "id" | "occurredUtc"> & { occurredUtc?: string; id?: string }): Promise<AuditEvent>;
  listAuditEvents(filters?: { threadId?: string; actorUserId?: string; eventType?: string }): Promise<AuditEvent[]>;
}

type MemoryState = {
  rooms: Room[];
  users: User[];
  messages: Message[];
  summaries: RoomSummary[];
  searchProjections: SearchProjection[];
  typing: TypingState[];
  threadPreferences: ThreadPreference[];
  notificationPreferences: NotificationPreference[];
  quickTemplates: QuickMessageTemplate[];
  auditEvents: AuditEvent[];
  processedKeys: Map<string, string>;
  sequenceByRoom: Map<string, number>;
};

export class MemoryStore implements DataStore {
  private state: MemoryState = {
    rooms: [],
    users: [],
    messages: [],
    summaries: [],
    searchProjections: [],
    typing: [],
    threadPreferences: [],
    notificationPreferences: [],
    quickTemplates: [],
    auditEvents: [],
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
        createdByUserId: "u1",
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
        createdByUserId: "u1",
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
      linkedContext: room.linkedContext,
      securityBindings: {
        tenantId: room.tenantId,
        visibleToUserIds: [...room.participantIds]
      }
    }));

    this.state.quickTemplates = [
      {
        id: "tmpl-ack",
        tenantId: demoTenantId,
        scopeType: "team",
        scopeId: "alpha",
        title: "Acknowledge",
        body: "Acknowledged. I am reviewing now.",
        active: true
      },
      {
        id: "tmpl-escalate",
        tenantId: demoTenantId,
        scopeType: "unit",
        scopeId: "ops",
        title: "Escalate",
        body: "Escalating to the on-call supervisor for immediate review.",
        active: true
      }
    ];

    this.state.notificationPreferences = this.state.users.map((user) => ({
      userId: user.id,
      tenantId: user.tenantId,
      muted: false,
      muteLowPriority: false,
      allowPriorityOverride: true
    }));

    this.state.threadPreferences = this.state.rooms.flatMap((room) =>
      room.participantIds.map((userId) => ({
        userId,
        threadId: room.id,
        pinned: false,
        archived: false,
        hidden: false,
        muted: false,
        markUnread: false,
        followUpFlag: false
      }))
    );

    for (const room of this.state.rooms) {
      await this.rebuildSearchProjection(room.id);
    }
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

  async updateMessage(roomId: string, messageId: string, input: { content?: string; priority?: Message["priority"] }): Promise<Message | null> {
    const message = this.state.messages.find((value) => value.roomId === roomId && value.id === messageId);
    if (!message) {
      return null;
    }
    if (typeof input.content === "string") {
      message.content = input.content;
      message.editedUtc = new Date().toISOString();
    }
    if (input.priority) {
      message.priority = input.priority;
    }
    await this.rebuildSearchProjection(roomId);
    return message;
  }

  async getMessage(roomId: string, messageId: string): Promise<Message | null> {
    const message = this.state.messages.find((value) => value.roomId === roomId && value.id === messageId);
    return message ?? null;
  }

  async deleteMessage(roomId: string, messageId: string): Promise<Message | null> {
    const message = this.state.messages.find((value) => value.roomId === roomId && value.id === messageId);
    if (!message) {
      return null;
    }
    message.deleted = true;
    message.content = "Message deleted";
    message.editedUtc = new Date().toISOString();
    await this.rebuildSearchProjection(roomId);
    return message;
  }

  async rebuildSearchProjection(roomId: string): Promise<void> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return;
    }

    const roomMessages = this.state.messages
      .filter((value) => value.roomId === roomId && !value.deleted)
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber);

    const projection: SearchProjection = {
      threadId: room.id,
      tenantId: room.tenantId,
      indexedContent: roomMessages.map((value) => value.content.toLowerCase()).join("\n"),
      lastMessagePreview: roomMessages.at(-1)?.content ?? "",
      visibleToUserIds: [...room.participantIds],
      entries: roomMessages.map((value) => ({
        messageId: value.id,
        indexedContent: value.content.toLowerCase()
      }))
    };

    const next = this.state.searchProjections.filter((value) => value.threadId !== roomId);
    next.push(projection);
    this.state.searchProjections = next;
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

  async markDelivered(roomId: string, messageId: string, userId: string): Promise<void> {
    const message = this.state.messages.find((value) => value.roomId === roomId && value.id === messageId);
    if (message && !message.deliveredToUserIds.includes(userId)) {
      message.deliveredToUserIds.push(userId);
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
    await this.upsertThreadPreference(userId, roomId, { pinned });
  }

  async getThreadPreference(userId: string, roomId: string): Promise<ThreadPreference> {
    const existing = this.state.threadPreferences.find((value) => value.userId === userId && value.threadId === roomId);
    if (existing) {
      return existing;
    }
    const created: ThreadPreference = {
      userId,
      threadId: roomId,
      pinned: false,
      archived: false,
      hidden: false,
      muted: false,
      markUnread: false,
      followUpFlag: false
    };
    this.state.threadPreferences.push(created);
    return created;
  }

  async upsertThreadPreference(
    userId: string,
    roomId: string,
    changes: Partial<Omit<ThreadPreference, "userId" | "threadId">>
  ): Promise<ThreadPreference> {
    const preference = await this.getThreadPreference(userId, roomId);
    Object.assign(preference, changes);
    return preference;
  }

  async getNotificationPreference(userId: string, threadId?: string): Promise<NotificationPreference> {
    const existing = this.state.notificationPreferences.find(
      (value) => value.userId === userId && value.threadId === threadId
    );
    if (existing) {
      return existing;
    }
    const tenantId = this.state.users.find((value) => value.id === userId)?.tenantId ?? demoTenantId;
    const created: NotificationPreference = {
      userId,
      tenantId,
      threadId,
      muted: false,
      muteLowPriority: false,
      allowPriorityOverride: true
    };
    this.state.notificationPreferences.push(created);
    return created;
  }

  async upsertNotificationPreference(
    userId: string,
    input: Omit<NotificationPreference, "userId" | "tenantId"> & { tenantId?: string }
  ): Promise<NotificationPreference> {
    const preference = await this.getNotificationPreference(userId, input.threadId);
    preference.tenantId = input.tenantId ?? preference.tenantId;
    preference.muted = input.muted;
    preference.muteLowPriority = input.muteLowPriority;
    preference.allowPriorityOverride = input.allowPriorityOverride;
    return preference;
  }

  async hasRoomAccess(userId: string, roomId: string): Promise<boolean> {
    return this.state.rooms.some((value) => value.id === roomId && value.participantIds.includes(userId));
  }

  async findRoomById(roomId: string): Promise<Room | null> {
    return this.state.rooms.find((value) => value.id === roomId) ?? null;
  }

  async listRooms(
    userId: string,
    options?: { includeArchived?: boolean; includeHidden?: boolean }
  ): Promise<Array<Room & { summary: RoomSummary }>> {
    return this.state.rooms
      .filter((value) => value.participantIds.includes(userId))
      .filter((room) => {
        const preference = this.state.threadPreferences.find((value) => value.userId === userId && value.threadId === room.id);
        if (!options?.includeHidden && preference?.hidden) {
          return false;
        }
        if (!options?.includeArchived && preference?.archived) {
          return false;
        }
        return true;
      })
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
            linkedContext: room.linkedContext,
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
        const leftFollowUp = this.state.threadPreferences.find((value) => value.userId === userId && value.threadId === left.id)?.followUpFlag ? 1 : 0;
        const rightFollowUp = this.state.threadPreferences.find((value) => value.userId === userId && value.threadId === right.id)?.followUpFlag ? 1 : 0;
        if (leftFollowUp !== rightFollowUp) {
          return rightFollowUp - leftFollowUp;
        }
        return right.summary.lastActivityUtc.localeCompare(left.summary.lastActivityUtc);
      });
  }

  async getRoom(
    userId: string,
    roomId: string
  ): Promise<(Room & { summary: RoomSummary; preference: ThreadPreference; notificationPreference: NotificationPreference }) | null> {
    const room = this.state.rooms.find((value) => value.id === roomId && value.participantIds.includes(userId));
    if (!room) {
      return null;
    }
    const summary = this.state.summaries.find((value) => value.roomId === room.id);
    return {
      ...room,
      summary:
        summary ?? {
          threadId: room.id,
          roomId: room.id,
          tenantId: room.tenantId,
          lastMessagePreview: "",
          unreadCountByUser: {},
          lastActivityUtc: room.createdUtc,
          participantSummary: this.state.users
            .filter((user) => room.participantIds.includes(user.id))
            .map((user) => ({ id: user.id, displayName: user.displayName, presence: user.presence })),
          linkedContext: room.linkedContext,
          securityBindings: {
            tenantId: room.tenantId,
            visibleToUserIds: [...room.participantIds]
          }
        },
      preference: await this.getThreadPreference(userId, room.id),
      notificationPreference: await this.getNotificationPreference(userId, room.id)
    };
  }

  async listRoomMembers(roomId: string): Promise<User[]> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return [];
    }
    return this.state.users.filter((value) => room.participantIds.includes(value.id));
  }

  async createRoom(input: {
    id?: string;
    actorUserId: string;
    name: string;
    type: Room["type"];
    participantIds: string[];
    linkedContext?: LinkedContext;
    metadata?: Record<string, unknown>;
  }): Promise<Room> {
    const now = new Date().toISOString();
    const room: Room = {
      id: input.id ?? `r-${Math.random().toString(16).slice(2, 10)}`,
      tenantId: demoTenantId,
      name: input.name,
      type: input.type,
      participantIds: Array.from(new Set([input.actorUserId, ...input.participantIds])),
      createdByUserId: input.actorUserId,
      createdUtc: now,
      lastActivityUtc: now,
      linkedContext: input.linkedContext,
      metadata: input.metadata ?? {},
      pinnedByUserIds: []
    };
    this.state.rooms.push(room);
    this.state.summaries.push({
      threadId: room.id,
      roomId: room.id,
      tenantId: room.tenantId,
      lastMessagePreview: "",
      unreadCountByUser: {},
      lastActivityUtc: room.createdUtc,
      participantSummary: this.state.users
        .filter((user) => room.participantIds.includes(user.id))
        .map((user) => ({ id: user.id, displayName: user.displayName, presence: user.presence })),
      linkedContext: room.linkedContext,
      securityBindings: {
        tenantId: room.tenantId,
        visibleToUserIds: [...room.participantIds]
      }
    });
    for (const participantId of room.participantIds) {
      await this.getThreadPreference(participantId, room.id);
      await this.getNotificationPreference(participantId, room.id);
    }
    await this.rebuildSearchProjection(room.id);
    return room;
  }

  async deleteRoom(roomId: string): Promise<Room | null> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return null;
    }
    this.state.rooms = this.state.rooms.filter((value) => value.id !== roomId);
    this.state.summaries = this.state.summaries.filter((value) => value.roomId !== roomId);
    this.state.messages = this.state.messages.filter((value) => value.roomId !== roomId);
    this.state.searchProjections = this.state.searchProjections.filter((value) => value.threadId !== roomId);
    this.state.threadPreferences = this.state.threadPreferences.filter((value) => value.threadId !== roomId);
    this.state.notificationPreferences = this.state.notificationPreferences.filter((value) => value.threadId !== roomId);
    return room;
  }

  async clearRoom(roomId: string): Promise<void> {
    this.state.messages = this.state.messages.filter((value) => value.roomId !== roomId);
    const summary = this.state.summaries.find((value) => value.roomId === roomId);
    if (summary) {
      summary.lastMessagePreview = "";
      summary.lastActivityUtc = new Date().toISOString();
      summary.unreadCountByUser = {};
    }
    await this.rebuildSearchProjection(roomId);
  }

  async addParticipants(roomId: string, participantIds: string[]): Promise<Room | null> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return null;
    }
    room.participantIds = Array.from(new Set([...room.participantIds, ...participantIds]));
    const summary = this.state.summaries.find((value) => value.roomId === roomId);
    if (summary) {
      summary.participantSummary = this.state.users
        .filter((user) => room.participantIds.includes(user.id))
        .map((user) => ({ id: user.id, displayName: user.displayName, presence: user.presence }));
      summary.securityBindings.visibleToUserIds = [...room.participantIds];
    }
    for (const participantId of participantIds) {
      await this.getThreadPreference(participantId, roomId);
      await this.getNotificationPreference(participantId, roomId);
    }
    await this.rebuildSearchProjection(roomId);
    return room;
  }

  async removeParticipant(roomId: string, userId: string): Promise<Room | null> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return null;
    }
    room.participantIds = room.participantIds.filter((value) => value !== userId);
    const summary = this.state.summaries.find((value) => value.roomId === roomId);
    if (summary) {
      summary.participantSummary = summary.participantSummary.filter((value) => value.id !== userId);
      summary.securityBindings.visibleToUserIds = [...room.participantIds];
    }
    await this.rebuildSearchProjection(roomId);
    return room;
  }

  async leaveRoom(roomId: string, userId: string): Promise<Room | null> {
    return this.removeParticipant(roomId, userId);
  }

  async linkContext(roomId: string, linkedContext: LinkedContext): Promise<Room | null> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return null;
    }
    room.linkedContext = linkedContext;
    const summary = this.state.summaries.find((value) => value.roomId === roomId);
    if (summary) {
      summary.linkedContext = linkedContext;
    }
    return room;
  }

  async updateAssignmentMembership(roomId: string, participantIds: string[]): Promise<Room | null> {
    const room = this.state.rooms.find((value) => value.id === roomId);
    if (!room) {
      return null;
    }
    room.participantIds = Array.from(new Set(participantIds));
    const summary = this.state.summaries.find((value) => value.roomId === roomId);
    if (summary) {
      summary.participantSummary = this.state.users
        .filter((user) => room.participantIds.includes(user.id))
        .map((user) => ({ id: user.id, displayName: user.displayName, presence: user.presence }));
      summary.securityBindings.visibleToUserIds = [...room.participantIds];
    }
    await this.rebuildSearchProjection(roomId);
    return room;
  }

  async listMessages(roomId: string, take: number): Promise<Message[]> {
    return this.state.messages
      .filter((value) => value.roomId === roomId)
      .sort((left, right) => right.sequenceNumber - left.sequenceNumber)
      .slice(0, take)
      .sort((left, right) => left.sequenceNumber - right.sequenceNumber);
  }

  async searchMessages(roomId: string, query: string, userId: string): Promise<Message[]> {
    const normalized = query.toLowerCase();
    const projection = this.state.searchProjections.find(
      (value) => value.threadId === roomId && value.visibleToUserIds.includes(userId)
    );
    if (!projection) {
      return [];
    }

    const matchingMessageIds = new Set(
      projection.entries.filter((entry) => entry.indexedContent.includes(normalized)).map((entry) => entry.messageId)
    );

    return this.state.messages.filter((value) => value.roomId === roomId && matchingMessageIds.has(value.id));
  }

  async listQuickTemplates(
    userId: string,
    filters?: { scopeType?: QuickMessageTemplate["scopeType"]; scopeId?: string; query?: string }
  ): Promise<QuickMessageTemplate[]> {
    const user = this.state.users.find((value) => value.id === userId);
    return this.state.quickTemplates.filter((template) => {
      if (!template.active) {
        return false;
      }
      if (filters?.scopeType && template.scopeType !== filters.scopeType) {
        return false;
      }
      if (filters?.scopeId && template.scopeId !== filters.scopeId) {
        return false;
      }
      if (filters?.query) {
        const normalized = filters.query.toLowerCase();
        if (!template.title.toLowerCase().includes(normalized) && !template.body.toLowerCase().includes(normalized)) {
          return false;
        }
      }
      if (!user) {
        return false;
      }
      return (
        template.scopeType === "tenant" ||
        (template.scopeType === "team" && user.attributes.team === template.scopeId) ||
        (template.scopeType === "unit" && user.attributes.unit === template.scopeId) ||
        (template.scopeType === "site" && user.attributes.location === template.scopeId) ||
        (template.scopeType === "department" && user.attributes.unit === template.scopeId)
      );
    });
  }

  async upsertQuickTemplate(input: Omit<QuickMessageTemplate, "id"> & { id?: string }): Promise<QuickMessageTemplate> {
    const template: QuickMessageTemplate = {
      ...input,
      id: input.id ?? `tmpl-${Math.random().toString(16).slice(2, 10)}`
    };
    this.state.quickTemplates = this.state.quickTemplates.filter((value) => value.id !== template.id);
    this.state.quickTemplates.push(template);
    return template;
  }

  async searchDirectory(filters?: { query?: string; role?: string; team?: string; location?: string; shift?: string }): Promise<User[]> {
    return this.state.users.filter((user) => {
      if (filters?.query) {
        const normalized = filters.query.toLowerCase();
        const haystack = [user.displayName, user.id, ...user.roleNames, user.attributes.team, user.attributes.unit, user.attributes.location]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalized)) {
          return false;
        }
      }
      if (filters?.role && !user.roleNames.includes(filters.role)) {
        return false;
      }
      if (filters?.team && user.attributes.team !== filters.team) {
        return false;
      }
      if (filters?.location && user.attributes.location !== filters.location) {
        return false;
      }
      if (filters?.shift && user.attributes.shift !== filters.shift) {
        return false;
      }
      return true;
    });
  }

  async appendAuditEvent(event: Omit<AuditEvent, "id" | "occurredUtc"> & { occurredUtc?: string; id?: string }): Promise<AuditEvent> {
    const entry: AuditEvent = {
      id: event.id ?? `audit-${Math.random().toString(16).slice(2, 10)}`,
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      occurredUtc: event.occurredUtc ?? new Date().toISOString(),
      payload: event.payload
    };
    this.state.auditEvents.push(entry);
    return entry;
  }

  async listAuditEvents(filters?: { threadId?: string; actorUserId?: string; eventType?: string }): Promise<AuditEvent[]> {
    return this.state.auditEvents.filter((event) => {
      if (filters?.threadId && event.payload.threadId !== filters.threadId) {
        return false;
      }
      if (filters?.actorUserId && event.actorUserId !== filters.actorUserId) {
        return false;
      }
      if (filters?.eventType && event.eventType !== filters.eventType) {
        return false;
      }
      return true;
    });
  }
}

// CosmosStore is intentionally light for this prototype and falls back to memory for read models.
export class CosmosStore extends MemoryStore {
  private readonly client: CosmosClient;
  private readonly eventsContainer: Container;

  constructor(connection: { endpoint: string; database: string; eventsContainer: string }) {
    super();
    // Managed-Identity/Entra auth only. Local keys are disabled at the Cosmos account per
    // tenant security policy (see hansen-project-styles/preferences/security.md).
    this.client = new CosmosClient({
      endpoint: connection.endpoint,
      aadCredentials: new DefaultAzureCredential()
    });
    this.eventsContainer = this.client.database(connection.database).container(connection.eventsContainer);
  }

  override async appendEvent(event: EventEnvelope): Promise<void> {
    await this.eventsContainer.items.create({ id: event.eventId, partitionKey: event.roomId ?? "global", ...event });
  }
}
