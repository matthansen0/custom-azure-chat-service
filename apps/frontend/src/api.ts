import type { Message, RealtimeNegotiation, Room, User } from "./types.js";

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

export async function searchInRoom(userId: string, roomId: string, query: string): Promise<Message[]> {
  const response = await fetch(`${apiBase}/rooms/${roomId}/search?query=${encodeURIComponent(query)}`, {
    headers: headers(userId)
  });
  const json = (await response.json()) as { messages: Message[] };
  return json.messages;
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
