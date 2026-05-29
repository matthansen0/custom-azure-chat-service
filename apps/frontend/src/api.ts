import type {
  AuditEvent,
  LinkedContext,
  Message,
  NotificationPreference,
  QuickMessageTemplate,
  RealtimeNegotiation,
  Room,
  RoomDetails,
  User
} from "./types.js";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

type DemoSession = {
  token: string;
  identity: {
    tenantId: string;
    userId: string;
    displayName: string;
    roleNames: string[];
    expiresUtc: string;
  };
};

let activeSession: DemoSession | null = null;

function isSessionCurrent(userId: string): boolean {
  if (!activeSession || activeSession.identity.userId !== userId) {
    return false;
  }
  return new Date(activeSession.identity.expiresUtc).getTime() - Date.now() > 30_000;
}

function headers(userId: string): HeadersInit {
  const nextHeaders: HeadersInit = {
    "Content-Type": "application/json",
    "x-demo-user": userId
  };

  if (activeSession?.identity.userId === userId) {
    return {
      ...nextHeaders,
      Authorization: `Bearer ${activeSession.token}`,
      "x-demo-tenant": activeSession.identity.tenantId
    };
  }

  return nextHeaders;
}

export async function demoLogin(userId: string): Promise<DemoSession> {
  if (isSessionCurrent(userId) && activeSession) {
    return activeSession;
  }

  const response = await fetch(`${apiBase}/auth/demo-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      displayName: userId,
      roleNames: ["demo-user"]
    })
  });

  const session = (await response.json()) as DemoSession;
  activeSession = session;
  return session;
}

export async function getRooms(userId: string): Promise<Room[]> {
  const response = await fetch(`${apiBase}/rooms`, { headers: headers(userId) });
  const json = (await response.json()) as { rooms: Room[] };
  return json.rooms;
}

export async function getRoomsWithFilters(
  userId: string,
  options?: { includeArchived?: boolean; includeHidden?: boolean }
): Promise<Room[]> {
  const url = new URL(`${apiBase}/rooms`, window.location.origin);
  if (options?.includeArchived) {
    url.searchParams.set("includeArchived", "true");
  }
  if (options?.includeHidden) {
    url.searchParams.set("includeHidden", "true");
  }
  const response = await fetch(url.toString(), { headers: headers(userId) });
  const json = (await response.json()) as { rooms: Room[] };
  return json.rooms;
}

export async function getRoomDetails(userId: string, roomId: string): Promise<RoomDetails> {
  const response = await fetch(`${apiBase}/rooms/${roomId}`, { headers: headers(userId) });
  const json = (await response.json()) as { room: RoomDetails };
  return json.room;
}

export async function createRoom(
  userId: string,
  input: {
    name: string;
    type: Room["type"];
    participantIds: string[];
    linkedContext?: LinkedContext;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const response = await fetch(`${apiBase}/rooms`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify(input)
  });
  const json = (await response.json()) as { roomId: string };
  return json.roomId;
}

export async function deleteRoom(userId: string, roomId: string) {
  await fetch(`${apiBase}/rooms/${roomId}`, {
    method: "DELETE",
    headers: headers(userId)
  });
}

export async function clearRoom(userId: string, roomId: string) {
  await fetch(`${apiBase}/rooms/${roomId}/clear`, {
    method: "POST",
    headers: headers(userId)
  });
}

export async function getMessages(userId: string, roomId: string): Promise<Message[]> {
  const response = await fetch(`${apiBase}/rooms/${roomId}/messages`, { headers: headers(userId) });
  const json = (await response.json()) as { messages: Message[] };
  return json.messages;
}

export async function getMembers(userId: string, roomId: string): Promise<User[]> {
  const response = await fetch(`${apiBase}/rooms/${roomId}/members`, { headers: headers(userId) });
  const json = (await response.json()) as { members: User[] };
  return json.members;
}

export async function sendMessage(userId: string, roomId: string, content: string, clientMessageId: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ content, clientMessageId })
  });
}

export async function updateMessage(userId: string, roomId: string, messageId: string, content: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}`, {
    method: "PATCH",
    headers: headers(userId),
    body: JSON.stringify({ content })
  });
}

export async function deleteMessage(userId: string, roomId: string, messageId: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}`, {
    method: "DELETE",
    headers: headers(userId)
  });
}

export async function deliverMessage(userId: string, roomId: string, messageId: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/deliver`, {
    method: "POST",
    headers: headers(userId)
  });
}

export async function setMessagePriority(userId: string, roomId: string, messageId: string, priority: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/priority`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ priority })
  });
}

export async function setTyping(userId: string, roomId: string, started: boolean) {
  await fetch(`${apiBase}/rooms/${roomId}/typing`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ started })
  });
}

export async function markRead(userId: string, roomId: string, messageId: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/read`, {
    method: "POST",
    headers: headers(userId)
  });
}

export async function addReaction(userId: string, roomId: string, messageId: string, reaction: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/reactions`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ reaction })
  });
}

export async function removeReaction(userId: string, roomId: string, messageId: string, reaction: string) {
  await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/reactions/${reaction}`, {
    method: "DELETE",
    headers: headers(userId)
  });
}

export async function setPin(userId: string, roomId: string, pinned: boolean) {
  await fetch(`${apiBase}/rooms/${roomId}/pin`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ pinned })
  });
}

export async function setThreadArchived(userId: string, roomId: string, archived: boolean) {
  await fetch(`${apiBase}/rooms/${roomId}/archive`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ archived })
  });
}

export async function setThreadHidden(userId: string, roomId: string, hidden: boolean) {
  await fetch(`${apiBase}/rooms/${roomId}/hide`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ hidden })
  });
}

export async function setThreadMarkUnread(userId: string, roomId: string, markUnread: boolean) {
  await fetch(`${apiBase}/rooms/${roomId}/mark-unread`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ markUnread })
  });
}

export async function setThreadFollowUp(userId: string, roomId: string, followUpFlag: boolean) {
  await fetch(`${apiBase}/rooms/${roomId}/follow-up`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ followUpFlag })
  });
}

export async function setNotificationPreference(
  userId: string,
  roomId: string,
  input: Pick<NotificationPreference, "muted" | "muteLowPriority" | "allowPriorityOverride">
) {
  await fetch(`${apiBase}/rooms/${roomId}/notification-preferences`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify(input)
  });
}

export async function addParticipants(userId: string, roomId: string, participantIds: string[]) {
  await fetch(`${apiBase}/rooms/${roomId}/participants`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ participantIds })
  });
}

export async function removeParticipant(userId: string, roomId: string, participantId: string) {
  await fetch(`${apiBase}/rooms/${roomId}/participants/${participantId}`, {
    method: "DELETE",
    headers: headers(userId)
  });
}

export async function leaveRoom(userId: string, roomId: string) {
  await fetch(`${apiBase}/rooms/${roomId}/leave`, {
    method: "POST",
    headers: headers(userId)
  });
}

export async function linkContext(userId: string, roomId: string, linkedContext: LinkedContext) {
  await fetch(`${apiBase}/rooms/${roomId}/context-link`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify(linkedContext)
  });
}

export async function updateAssignmentMembership(userId: string, roomId: string, participantIds: string[]) {
  await fetch(`${apiBase}/rooms/${roomId}/assignment-membership`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ participantIds })
  });
}

export async function searchInRoom(userId: string, roomId: string, query: string): Promise<Message[]> {
  const response = await fetch(`${apiBase}/rooms/${roomId}/search?query=${encodeURIComponent(query)}`, {
    headers: headers(userId)
  });
  const json = (await response.json()) as { messages: Message[] };
  return json.messages;
}

export async function getTemplates(
  userId: string,
  filters?: { scopeType?: QuickMessageTemplate["scopeType"]; scopeId?: string; query?: string }
): Promise<QuickMessageTemplate[]> {
  const url = new URL(`${apiBase}/templates`, window.location.origin);
  if (filters?.scopeType) {
    url.searchParams.set("scopeType", filters.scopeType);
  }
  if (filters?.scopeId) {
    url.searchParams.set("scopeId", filters.scopeId);
  }
  if (filters?.query) {
    url.searchParams.set("query", filters.query);
  }
  const response = await fetch(url.toString(), { headers: headers(userId) });
  if (!response.ok) {
    return [];
  }
  const json = (await response.json()) as { templates: QuickMessageTemplate[] };
  return json.templates;
}

export async function createTemplate(userId: string, template: Omit<QuickMessageTemplate, "id" | "tenantId">) {
  await fetch(`${apiBase}/templates`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify(template)
  });
}

export async function updateTemplate(userId: string, templateId: string, template: Omit<QuickMessageTemplate, "id" | "tenantId">) {
  await fetch(`${apiBase}/templates/${templateId}`, {
    method: "PATCH",
    headers: headers(userId),
    body: JSON.stringify(template)
  });
}

export async function getDirectory(
  userId: string,
  filters?: { query?: string; role?: string; team?: string; location?: string; shift?: string }
): Promise<User[]> {
  const url = new URL(`${apiBase}/directory`, window.location.origin);
  if (filters?.query) {
    url.searchParams.set("query", filters.query);
  }
  if (filters?.role) {
    url.searchParams.set("role", filters.role);
  }
  if (filters?.team) {
    url.searchParams.set("team", filters.team);
  }
  if (filters?.location) {
    url.searchParams.set("location", filters.location);
  }
  if (filters?.shift) {
    url.searchParams.set("shift", filters.shift);
  }
  const response = await fetch(url.toString(), { headers: headers(userId) });
  if (!response.ok) {
    return [];
  }
  const json = (await response.json()) as { users: User[] };
  return json.users;
}

export async function getAuditEvents(
  userId: string,
  filters?: { threadId?: string; actorUserId?: string; eventType?: string }
): Promise<AuditEvent[]> {
  const url = new URL(`${apiBase}/audit-events`, window.location.origin);
  if (filters?.threadId) {
    url.searchParams.set("threadId", filters.threadId);
  }
  if (filters?.actorUserId) {
    url.searchParams.set("actorUserId", filters.actorUserId);
  }
  if (filters?.eventType) {
    url.searchParams.set("eventType", filters.eventType);
  }
  const response = await fetch(url.toString(), { headers: headers(userId) });
  if (!response.ok) {
    return [];
  }
  const json = (await response.json()) as { auditEvents: AuditEvent[] };
  return json.auditEvents;
}

export async function negotiate(userId: string, roomId: string): Promise<RealtimeNegotiation> {
  const url = new URL(`${apiBase}/realtime/negotiate`, window.location.origin);
  url.searchParams.set("roomId", roomId);
  const authorizedResponse = await fetch(url.toString(), {
    headers: headers(userId)
  });
  if (!authorizedResponse.ok) {
    throw new Error(`Realtime negotiation failed with status ${authorizedResponse.status}`);
  }
  const json = (await authorizedResponse.json()) as RealtimeNegotiation;
  return json;
}
