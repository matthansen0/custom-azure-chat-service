import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createChatApp } from "../src/app.js";
import { NoopPublisher } from "../src/eventing/publisher.js";
import { MemoryStore } from "../src/persistence/store.js";

type TestServer = {
  server: Server;
  baseUrl: string;
};

async function startTestServer(): Promise<TestServer> {
  const store = new MemoryStore();
  await store.ensureSeedData();
  const { app } = createChatApp({
    corsOrigin: "http://localhost:5173",
    store,
    publisher: new NoopPublisher()
  });

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP port");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/api`
  };
}

async function stopTestServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function demoLogin(baseUrl: string, userId: string): Promise<string> {
  const response = await fetch(`${baseUrl}/auth/demo-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, displayName: userId, roleNames: ["demo-user"] })
  });
  const json = (await response.json()) as { token: string };
  return json.token;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

test("Pass 3 supports room administration, preferences, context, assignment, and audit flows", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const token = await demoLogin(baseUrl, "u1");

    const directoryResponse = await fetch(`${baseUrl}/directory?team=alpha`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const directoryJson = (await directoryResponse.json()) as { users: Array<{ id: string }> };
    assert.deepEqual(
      directoryJson.users.map((user) => user.id).sort(),
      ["u1", "u2"]
    );

    const createRoomResponse = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        name: "Shift Handoff",
        type: "group",
        participantIds: ["u2"],
        linkedContext: {
          type: "case",
          contextId: "case-42",
          label: "Case 42",
          metadata: { severity: "high" }
        },
        metadata: { source: "pass3-test" }
      })
    });
    assert.equal(createRoomResponse.status, 201);
    const createRoomJson = (await createRoomResponse.json()) as { roomId: string };
    const roomId = createRoomJson.roomId;

    const addParticipantsResponse = await fetch(`${baseUrl}/rooms/${roomId}/participants`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ participantIds: ["u3"] })
    });
    assert.equal(addParticipantsResponse.status, 201);

    const followUpResponse = await fetch(`${baseUrl}/rooms/${roomId}/follow-up`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ followUpFlag: true })
    });
    assert.equal(followUpResponse.status, 201);

    const notificationResponse = await fetch(`${baseUrl}/rooms/${roomId}/notification-preferences`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ muted: true, muteLowPriority: true, allowPriorityOverride: true })
    });
    assert.equal(notificationResponse.status, 201);

    const contextResponse = await fetch(`${baseUrl}/rooms/${roomId}/context-link`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        type: "case",
        contextId: "case-43",
        label: "Case 43",
        metadata: { severity: "urgent" }
      })
    });
    assert.equal(contextResponse.status, 201);

    const assignmentResponse = await fetch(`${baseUrl}/rooms/${roomId}/assignment-membership`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ participantIds: ["u1", "u3"] })
    });
    assert.equal(assignmentResponse.status, 201);

    const roomResponse = await fetch(`${baseUrl}/rooms/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const roomJson = (await roomResponse.json()) as {
      room: {
        participantIds: string[];
        summary: { linkedContext?: { contextId: string } };
        preference: { followUpFlag: boolean };
        notificationPreference: { muted: boolean; muteLowPriority: boolean; allowPriorityOverride: boolean };
      };
    };

    assert.deepEqual(roomJson.room.participantIds.sort(), ["u1", "u3"]);
    assert.equal(roomJson.room.summary.linkedContext?.contextId, "case-43");
    assert.equal(roomJson.room.preference.followUpFlag, true);
    assert.equal(roomJson.room.notificationPreference.muted, true);
    assert.equal(roomJson.room.notificationPreference.muteLowPriority, true);

    const auditResponse = await fetch(`${baseUrl}/audit-events?threadId=${encodeURIComponent(roomId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const auditJson = (await auditResponse.json()) as { auditEvents: Array<{ eventType: string }> };
    assert.ok(auditJson.auditEvents.some((event) => event.eventType === "ThreadCreated"));
    assert.ok(auditJson.auditEvents.some((event) => event.eventType === "ParticipantAdded"));
    assert.ok(auditJson.auditEvents.some((event) => event.eventType === "AssignmentMembershipUpdated"));

    const hideResponse = await fetch(`${baseUrl}/rooms/${roomId}/hide`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ hidden: true })
    });
    assert.equal(hideResponse.status, 201);

    const roomsHiddenResponse = await fetch(`${baseUrl}/rooms`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const roomsHiddenJson = (await roomsHiddenResponse.json()) as { rooms: Array<{ id: string }> };
    assert.equal(roomsHiddenJson.rooms.some((room) => room.id === roomId), false);

    const roomsVisibleResponse = await fetch(`${baseUrl}/rooms?includeHidden=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const roomsVisibleJson = (await roomsVisibleResponse.json()) as { rooms: Array<{ id: string }> };
    assert.equal(roomsVisibleJson.rooms.some((room) => room.id === roomId), true);
  } finally {
    await stopTestServer(server);
  }
});

test("Pass 3 supports message lifecycle and quick template administration", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const token = await demoLogin(baseUrl, "u1");

    const createTemplateResponse = await fetch(`${baseUrl}/templates`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        scopeType: "team",
        scopeId: "alpha",
        title: "Need backup",
        body: "Requesting immediate backup to the active room.",
        active: true
      })
    });
    assert.equal(createTemplateResponse.status, 201);
    const createTemplateJson = (await createTemplateResponse.json()) as { event: { entityId: string } };

    const updateTemplateResponse = await fetch(`${baseUrl}/templates/${createTemplateJson.event.entityId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        scopeType: "team",
        scopeId: "alpha",
        title: "Need backup now",
        body: "Requesting immediate backup now.",
        active: true
      })
    });
    assert.equal(updateTemplateResponse.status, 200);

    const listTemplatesResponse = await fetch(`${baseUrl}/templates?query=backup`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listTemplatesJson = (await listTemplatesResponse.json()) as { templates: Array<{ title: string }> };
    assert.ok(listTemplatesJson.templates.some((template) => template.title === "Need backup now"));

    const sendMessageResponse = await fetch(`${baseUrl}/rooms/r-ops/messages`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        content: "Templated backup request",
        clientMessageId: "pass3-template-send"
      })
    });
    assert.equal(sendMessageResponse.status, 201);
    const sendMessageJson = (await sendMessageResponse.json()) as { event: { entityId: string; payload: { messageId: string } } };
    const messageId = sendMessageJson.event.payload.messageId;

    const priorityResponse = await fetch(`${baseUrl}/rooms/r-ops/messages/${messageId}/priority`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ priority: "urgent" })
    });
    assert.equal(priorityResponse.status, 201);

    const deliverResponse = await fetch(`${baseUrl}/rooms/r-ops/messages/${messageId}/deliver`, {
      method: "POST",
      headers: authHeaders(token)
    });
    assert.equal(deliverResponse.status, 201);

    const editResponse = await fetch(`${baseUrl}/rooms/r-ops/messages/${messageId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ content: "Templated backup request updated" })
    });
    assert.equal(editResponse.status, 200);

    const searchResponse = await fetch(`${baseUrl}/rooms/r-ops/search?query=updated`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchJson = (await searchResponse.json()) as { messages: Array<{ id: string; priority: string; deliveredToUserIds: string[] }> };
    assert.equal(searchJson.messages[0]?.id, messageId);

    const deleteResponse = await fetch(`${baseUrl}/rooms/r-ops/messages/${messageId}`, {
      method: "DELETE",
      headers: authHeaders(token)
    });
    assert.equal(deleteResponse.status, 200);

    const messagesResponse = await fetch(`${baseUrl}/rooms/r-ops/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const messagesJson = (await messagesResponse.json()) as {
      messages: Array<{ id: string; content: string; deleted: boolean; priority: string; deliveredToUserIds: string[] }>;
    };
    const updatedMessage = messagesJson.messages.find((message) => message.id === messageId);
    assert.ok(updatedMessage);
    assert.equal(updatedMessage?.priority, "urgent");
    assert.equal(updatedMessage?.deleted, true);
    assert.equal(updatedMessage?.content, "Message deleted");
    assert.ok(updatedMessage?.deliveredToUserIds.includes("u1"));
  } finally {
    await stopTestServer(server);
  }
});