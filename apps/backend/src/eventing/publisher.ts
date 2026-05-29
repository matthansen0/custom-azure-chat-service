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
  getClientAccessToken(input: { userId: string; tenantId: string; roomId: string }): Promise<RealtimeNegotiation>;
}

export class NoopPublisher implements RealtimePublisher {
  async publish(_event: EventEnvelope): Promise<void> {
    return;
  }

  async getClientAccessToken(_input: { userId: string; tenantId: string; roomId: string }): Promise<RealtimeNegotiation> {
    return { kind: "local", url: "" };
  }
}

export class LocalRealtimePublisher implements RealtimePublisher {
  private readonly webSocketServer = new WebSocketServer({ noServer: true });
  private readonly connectionsByRoom = new Map<string, Set<WebSocket>>();

  constructor(
    input: {
      server: HttpServer;
      store: DataStore;
      secret: string;
      port: number;
    }
  ) {
    input.server.on("upgrade", async (request, socket, head) => {
      const url = this.parseUrl(request);
      if (!url || url.pathname !== "/realtime/socket") {
        socket.destroy();
        return;
      }

      const roomId = url.searchParams.get("roomId") ?? "";
      const token = url.searchParams.get("token") ?? "";
      const identity = verifyDemoIdentityToken(token, input.secret);
      const allowed = identity && roomId ? await input.store.hasRoomAccess(identity.userId, roomId) : false;
      if (!identity || !allowed) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      this.webSocketServer.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
        this.trackConnection(roomId, webSocket);
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
      for (const sockets of this.connectionsByRoom.values()) {
        for (const socket of sockets) {
          if (socket.readyState === socket.OPEN) {
            socket.send(payload);
          }
        }
      }
      return;
    }

    for (const socket of this.connectionsByRoom.get(event.roomId) ?? []) {
      if (socket.readyState === socket.OPEN) {
        socket.send(payload);
      }
    }
  }

  async getClientAccessToken(input: { userId: string; tenantId: string; roomId: string }): Promise<RealtimeNegotiation> {
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
      url: `ws://127.0.0.1:${this.port}/realtime/socket?roomId=${encodeURIComponent(input.roomId)}&token=${encodeURIComponent(token.token)}`
    };
  }

  private parseUrl(request: IncomingMessage): URL | null {
    const host = request.headers.host;
    if (!request.url || !host) {
      return null;
    }
    return new URL(request.url, `http://${host}`);
  }

  private trackConnection(roomId: string, socket: WebSocket): void {
    const current = this.connectionsByRoom.get(roomId) ?? new Set<WebSocket>();
    current.add(socket);
    this.connectionsByRoom.set(roomId, current);

    socket.on("close", () => {
      const sockets = this.connectionsByRoom.get(roomId);
      if (!sockets) {
        return;
      }
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.connectionsByRoom.delete(roomId);
      }
    });
  }
}

export class WebPubSubPublisher implements RealtimePublisher {
  private readonly serviceClient: WebPubSubServiceClient;

  constructor(connectionString: string, hub: string) {
    this.serviceClient = new WebPubSubServiceClient(connectionString, hub);
  }

  async publish(event: EventEnvelope): Promise<void> {
    if (!event.roomId) {
      await this.serviceClient.sendToAll({ type: "event", event });
      return;
    }
    await this.serviceClient.group(`room-${event.roomId}`).sendToAll({ type: "event", event });
  }

  async getClientAccessToken(input: { userId: string; tenantId: string; roomId: string }): Promise<RealtimeNegotiation> {
    const token = await this.serviceClient.getClientAccessToken({
      userId: input.userId,
      roles: ["webpubsub.joinLeaveGroup", "webpubsub.sendToGroup"]
    });
    return { kind: "webpubsub", url: token.url };
  }
}
