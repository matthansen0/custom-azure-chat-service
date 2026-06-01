import { DefaultAzureCredential } from "@azure/identity";
import { WebPubSubServiceClient } from "@azure/web-pubsub";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { issueDemoIdentityToken, verifyDemoIdentityToken } from "../auth/demoIdentity.js";
import type { EventEnvelope } from "../events/contracts.js";
import type { DataStore } from "../persistence/store.js";

export type RealtimeNegotiation = {
  kind: "webpubsub" | "local";
  url: string;
};

export interface RealtimePublisher {
  publish(event: EventEnvelope): Promise<void>;
  getClientAccessToken(input: { userId: string; tenantId: string }): Promise<RealtimeNegotiation>;
}

export class NoopPublisher implements RealtimePublisher {
  async publish(_event: EventEnvelope): Promise<void> {
    return;
  }

  async getClientAccessToken(_input: { userId: string; tenantId: string }): Promise<RealtimeNegotiation> {
    return { kind: "local", url: "" };
  }
}

export class LocalRealtimePublisher implements RealtimePublisher {
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private readonly connectionsByUser = new Map<string, Set<WebSocket>>();
  private readonly store: DataStore;

  constructor(
    input: {
      server: HttpServer;
      store: DataStore;
      secret: string;
      port: number;
    }
  ) {
    this.store = input.store;
    input.server.on("upgrade", async (request, socket, head) => {
      const url = this.parseUrl(request);
      if (!url || url.pathname !== "/realtime/socket") {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get("token") ?? "";
      const identity = verifyDemoIdentityToken(token, input.secret);
      if (!identity) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.webSocketServer.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
        this.trackConnection(identity.userId, webSocket);
      });
    });

    this.port = input.port;
    this.secret = input.secret;
  }

  private readonly port: number;
  private readonly secret: string;

  async publish(event: EventEnvelope): Promise<void> {
    const payload = JSON.stringify({ type: "event", event });
    if (!event.roomId) {
      for (const sockets of this.connectionsByUser.values()) {
        for (const socket of sockets) {
          if (socket.readyState === socket.OPEN) {
            socket.send(payload);
          }
        }
      }
      return;
    }

    const room = await this.store.findRoomById(event.roomId);
    const participantIds = room?.participantIds ?? [];
    for (const userId of participantIds) {
      for (const socket of this.connectionsByUser.get(userId) ?? []) {
        if (socket.readyState === socket.OPEN) {
          socket.send(payload);
        }
      }
    }
  }

  async getClientAccessToken(input: { userId: string; tenantId: string }): Promise<RealtimeNegotiation> {
    const token = issueDemoIdentityToken({
      tenantId: input.tenantId,
      userId: input.userId,
      displayName: input.userId,
      roleNames: ["demo-user"],
      secret: this.secret,
      ttlMinutes: 15
    });
    return {
      kind: "local",
      url: `ws://127.0.0.1:${this.port}/realtime/socket?token=${encodeURIComponent(token.token)}`
    };
  }

  private parseUrl(request: IncomingMessage): URL | null {
    const host = request.headers.host;
    if (!request.url || !host) {
      return null;
    }
    return new URL(request.url, `http://${host}`);
  }

  private trackConnection(userId: string, socket: WebSocket): void {
    const current = this.connectionsByUser.get(userId) ?? new Set<WebSocket>();
    current.add(socket);
    this.connectionsByUser.set(userId, current);

    socket.on("close", () => {
      const sockets = this.connectionsByUser.get(userId);
      if (!sockets) {
        return;
      }
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.connectionsByUser.delete(userId);
      }
    });
  }
}

export class WebPubSubPublisher implements RealtimePublisher {
  private readonly serviceClient: WebPubSubServiceClient;
  private readonly store: DataStore;

  constructor(endpoint: string, hub: string, store: DataStore) {
    // Entra ID via system-assigned managed identity. Local auth (connection string / access
    // keys) is disabled on the Web PubSub resource per tenant security policy.
    this.serviceClient = new WebPubSubServiceClient(endpoint, new DefaultAzureCredential(), hub);
    this.store = store;
  }

  async publish(event: EventEnvelope): Promise<void> {
    const payload = { type: "event", event };
    if (!event.roomId) {
      await this.serviceClient.sendToAll(payload);
      return;
    }
    const room = await this.store.findRoomById(event.roomId);
    const participantIds = room?.participantIds ?? [];
    await Promise.all(
      participantIds.map((userId) => this.serviceClient.sendToUser(userId, payload))
    );
  }

  async getClientAccessToken(input: { userId: string; tenantId: string }): Promise<RealtimeNegotiation> {
    const token = await this.serviceClient.getClientAccessToken({
      userId: input.userId
    });
    return { kind: "webpubsub", url: token.url };
  }
}
