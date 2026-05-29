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
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      displayName: userId,
      roleNames: ["demo-user"]
    })
  });
  const json = (await response.json()) as { token: string };
  return json.token;
}

test("Pass 2 API requires authentication for room lists", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const response = await fetch(`${baseUrl}/rooms`);
    assert.equal(response.status, 401);
  } finally {
    await stopTestServer(server);
  }
});

test("Pass 2 API blocks room access for non-participants", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const token = await demoLogin(baseUrl, "u3");
    const response = await fetch(`${baseUrl}/rooms/r-direct-u1-u2/messages`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    assert.equal(response.status, 403);
  } finally {
    await stopTestServer(server);
  }
});

test("Pass 2 API persists messages, updates search projection, and returns room ordering metadata", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const token = await demoLogin(baseUrl, "u1");
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    const sendResponse = await fetch(`${baseUrl}/rooms/r-ops/messages`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        content: "pass2 search needle",
        clientMessageId: "client-pass2-search"
      })
    });
    assert.equal(sendResponse.status, 201);

    const messagesResponse = await fetch(`${baseUrl}/rooms/r-ops/messages`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const messagesJson = (await messagesResponse.json()) as { messages: Array<{ content: string; sequenceNumber: number }> };
    assert.equal(messagesJson.messages.at(-1)?.content, "pass2 search needle");
    assert.ok((messagesJson.messages.at(-1)?.sequenceNumber ?? 0) > 0);

    const searchResponse = await fetch(`${baseUrl}/rooms/r-ops/search?query=needle`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const searchJson = (await searchResponse.json()) as { messages: Array<{ content: string }> };
    assert.deepEqual(searchJson.messages.map((message) => message.content), ["pass2 search needle"]);

    const pinResponse = await fetch(`${baseUrl}/rooms/r-ops/pin`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ pinned: true })
    });
    assert.equal(pinResponse.status, 201);

    const roomsResponse = await fetch(`${baseUrl}/rooms`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const roomsJson = (await roomsResponse.json()) as {
      rooms: Array<{ id: string; pinnedByUserIds: string[]; summary: { lastMessagePreview: string } }>;
    };
    assert.equal(roomsJson.rooms[0]?.id, "r-ops");
    assert.ok(roomsJson.rooms[0]?.pinnedByUserIds.includes("u1"));
    assert.equal(roomsJson.rooms[0]?.summary.lastMessagePreview, "pass2 search needle");
  } finally {
    await stopTestServer(server);
  }
});