import { type Request, type Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { config } from "../config.js";
import { ChatCommands } from "../commands/chatCommands.js";
import { issueDemoIdentityToken, resolveDemoIdentity } from "../auth/demoIdentity.js";
import { EventRouter } from "../eventing/router.js";
import type { RealtimePublisher } from "../eventing/publisher.js";
import type { DataStore } from "../persistence/store.js";

export function createApiRouter(dependencies: {
  commands: ChatCommands;
  eventRouter: EventRouter;
  publisher: RealtimePublisher;
  store: DataStore;
}) {
  const router = Router();

  const messageSchema = z.object({
    content: z.string().min(1).max(3000),
    clientMessageId: z.string().optional()
  });
  const loginSchema = z.object({
    userId: z.string().min(1),
    tenantId: z.string().min(1).default(config.demoTenantId),
    displayName: z.string().min(1).optional(),
    roleNames: z.array(z.string().min(1)).default(["demo-user"])
  });

  function requireIdentity(request: Request, response: Response) {
    const identity = resolveDemoIdentity(request, {
      secret: config.demoAuthSecret,
      defaultTenantId: config.demoTenantId,
      allowHeaderFallback: false
    });
    if (!identity) {
      response.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return identity;
  }

  async function requireRoomAccess(request: Request, response: Response) {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return null;
    }

    const allowed = await dependencies.store.hasRoomAccess(identity.userId, String(request.params.roomId));
    if (!allowed) {
      response.status(403).json({ error: "Forbidden" });
      return null;
    }

    return identity;
  }

  router.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  router.post("/auth/demo-login", (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const token = issueDemoIdentityToken({
      tenantId: parsed.data.tenantId,
      userId: parsed.data.userId,
      displayName: parsed.data.displayName ?? parsed.data.userId,
      roleNames: parsed.data.roleNames,
      secret: config.demoAuthSecret,
      ttlMinutes: config.demoAuthTokenTtlMinutes
    });

    response.status(201).json(token);
  });

  router.get("/realtime/negotiate", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const roomId = String(request.query.roomId ?? "");
    if (!roomId || !(await dependencies.store.hasRoomAccess(identity.userId, roomId))) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }
    response.json(await dependencies.publisher.getClientAccessToken({ userId: identity.userId, tenantId: identity.tenantId, roomId }));
  });

  router.get("/rooms", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const rooms = await dependencies.store.listRooms(identity.userId);
    response.json({ rooms });
  });

  router.get("/rooms/:roomId/messages", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const take = Number(request.query.take ?? 50);
    const messages = await dependencies.store.listMessages(request.params.roomId, Math.min(200, Math.max(1, take)));
    response.json({ messages });
  });

  router.get("/rooms/:roomId/members", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const members = await dependencies.store.listRoomMembers(request.params.roomId);
    response.json({ members });
  });

  router.get("/rooms/:roomId/search", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const query = String(request.query.query ?? "");
    const messages = query
      ? await dependencies.store.searchMessages(request.params.roomId, query, identity.userId)
      : await dependencies.store.listMessages(request.params.roomId, 50);
    response.json({ messages });
  });

  router.post("/rooms/:roomId/messages", async (request, response) => {
    const parsed = messageSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await dependencies.commands.createMessage({
      roomId: request.params.roomId,
      actorUserId: identity.userId,
      content: parsed.data.content,
      clientMessageId: parsed.data.clientMessageId,
      idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
    });

    if (!event) {
      response.status(202).json({ duplicate: true });
      return;
    }

    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/messages/:messageId/read", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await dependencies.commands.createRead({
      roomId: request.params.roomId,
      actorUserId: identity.userId,
      messageId: request.params.messageId,
      idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
    });

    if (!event) {
      response.status(202).json({ duplicate: true });
      return;
    }

    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/messages/:messageId/reactions", async (request, response) => {
    const reaction = String(request.body?.reaction ?? "thumbsUp");
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await dependencies.commands.createReaction({
      roomId: request.params.roomId,
      actorUserId: identity.userId,
      messageId: request.params.messageId,
      reaction,
      add: true,
      idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
    });
    if (!event) {
      response.status(202).json({ duplicate: true });
      return;
    }
    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    response.status(201).json({ event });
  });

  router.delete("/rooms/:roomId/messages/:messageId/reactions/:reaction", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await dependencies.commands.createReaction({
      roomId: request.params.roomId,
      actorUserId: identity.userId,
      messageId: request.params.messageId,
      reaction: request.params.reaction,
      add: false,
      idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
    });
    if (!event) {
      response.status(202).json({ duplicate: true });
      return;
    }
    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/typing", async (request, response) => {
    const started = request.body?.started !== false;
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await dependencies.commands.createTyping({
      roomId: request.params.roomId,
      actorUserId: identity.userId,
      started,
      idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
    });
    if (!event) {
      response.status(202).json({ duplicate: true });
      return;
    }
    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/pin", async (request, response) => {
    const pinned = Boolean(request.body?.pinned);
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await dependencies.commands.createPinToggle({
      roomId: request.params.roomId,
      actorUserId: identity.userId,
      pinned,
      idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
    });
    if (!event) {
      response.status(202).json({ duplicate: true });
      return;
    }
    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    response.status(201).json({ event });
  });

  router.post("/presence", async (request, response) => {
    const presence = (request.body?.presence as "online" | "offline" | "away") ?? "online";
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const event = await dependencies.commands.createPresence({
      actorUserId: identity.userId,
      presence,
      idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
    });
    if (!event) {
      response.status(202).json({ duplicate: true });
      return;
    }
    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    response.status(201).json({ event });
  });

  return router;
}
