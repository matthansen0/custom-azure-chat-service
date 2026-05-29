import { type Request, type Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { config } from "../config.js";
import { ChatCommands } from "../commands/chatCommands.js";
import { issueDemoIdentityToken, resolveDemoIdentity } from "../auth/demoIdentity.js";
import type { EventEnvelope } from "../events/contracts.js";
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
  const messageUpdateSchema = z.object({
    content: z.string().min(1).max(3000).optional()
  });
  const prioritySchema = z.object({
    priority: z.enum(["low", "normal", "high", "urgent"])
  });
  const threadCreateSchema = z.object({
    name: z.string().min(1).max(120),
    type: z.enum(["direct", "group", "system", "announcement"]),
    participantIds: z.array(z.string().min(1)).default([]),
    linkedContext: z
      .object({
        type: z.string().min(1),
        contextId: z.string().min(1),
        label: z.string().min(1),
        metadata: z.record(z.any()).default({})
      })
      .optional(),
    metadata: z.record(z.any()).default({})
  });
  const participantSchema = z.object({
    participantIds: z.array(z.string().min(1)).min(1)
  });
  const threadBooleanSchema = z.object({
    value: z.boolean()
  });
  const notificationPreferenceSchema = z.object({
    muted: z.boolean(),
    muteLowPriority: z.boolean(),
    allowPriorityOverride: z.boolean()
  });
  const templateSchema = z.object({
    id: z.string().optional(),
    scopeType: z.enum(["tenant", "site", "unit", "department", "team"]),
    scopeId: z.string().min(1),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(1000),
    active: z.boolean().default(true)
  });
  const linkedContextSchema = z.object({
    type: z.string().min(1),
    contextId: z.string().min(1),
    label: z.string().min(1),
    metadata: z.record(z.any()).default({})
  });
  const assignmentSchema = z.object({
    participantIds: z.array(z.string().min(1)).min(1)
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

  async function emitEvent(response: Response, eventPromise: Promise<EventEnvelope | null>) {
    const event = await eventPromise;
    if (!event) {
      response.status(202).json({ duplicate: true });
      return null;
    }
    await dependencies.eventRouter.handle(event);
    await dependencies.publisher.publish(event);
    return event;
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
    const rooms = await dependencies.store.listRooms(identity.userId, {
      includeArchived: String(request.query.includeArchived ?? "false") === "true",
      includeHidden: String(request.query.includeHidden ?? "false") === "true"
    });
    response.json({ rooms });
  });

  router.post("/rooms", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const parsed = threadCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const event = await emitEvent(
      response,
      dependencies.commands.createThread({
        actorUserId: identity.userId,
        name: parsed.data.name,
        type: parsed.data.type,
        participantIds: parsed.data.participantIds,
        linkedContext: parsed.data.linkedContext,
        metadata: parsed.data.metadata,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event, roomId: event.entityId });
  });

  router.get("/rooms/:roomId", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const room = await dependencies.store.getRoom(identity.userId, request.params.roomId);
    response.json({ room });
  });

  router.delete("/rooms/:roomId", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createThreadDelete({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(200).json({ event });
  });

  router.post("/rooms/:roomId/clear", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createThreadClear({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(200).json({ event });
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
    const event = await emitEvent(
      response,
      dependencies.commands.createMessage({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        content: parsed.data.content,
        clientMessageId: parsed.data.clientMessageId,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.patch("/rooms/:roomId/messages/:messageId", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = messageUpdateSchema.safeParse(request.body);
    if (!parsed.success || !parsed.data.content) {
      response.status(400).json({ error: parsed.success ? "content is required" : parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createMessageEdit({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        messageId: request.params.messageId,
        content: parsed.data.content,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(200).json({ event });
  });

  router.delete("/rooms/:roomId/messages/:messageId", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createMessageDelete({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        messageId: request.params.messageId,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(200).json({ event });
  });

  router.post("/rooms/:roomId/messages/:messageId/deliver", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createMessageDelivered({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        messageId: request.params.messageId,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/messages/:messageId/priority", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = prioritySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createMessagePriority({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        messageId: request.params.messageId,
        priority: parsed.data.priority,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/messages/:messageId/read", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createRead({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        messageId: request.params.messageId,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/messages/:messageId/reactions", async (request, response) => {
    const reaction = String(request.body?.reaction ?? "thumbsUp");
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createReaction({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        messageId: request.params.messageId,
        reaction,
        add: true,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.delete("/rooms/:roomId/messages/:messageId/reactions/:reaction", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createReaction({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        messageId: request.params.messageId,
        reaction: request.params.reaction,
        add: false,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/typing", async (request, response) => {
    const started = request.body?.started !== false;
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createTyping({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        started,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/pin", async (request, response) => {
    const pinned = Boolean(request.body?.pinned);
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createPinToggle({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        pinned,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/archive", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = threadBooleanSchema.safeParse({ value: request.body?.archived });
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createThreadPreferenceEvent({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        eventType: "ThreadArchived",
        payload: { archived: parsed.data.value },
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/hide", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = threadBooleanSchema.safeParse({ value: request.body?.hidden });
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createThreadPreferenceEvent({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        eventType: "ThreadRemovedFromList",
        payload: { hidden: parsed.data.value },
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/mark-unread", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = threadBooleanSchema.safeParse({ value: request.body?.markUnread });
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createThreadPreferenceEvent({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        eventType: "ThreadMarkedUnread",
        payload: { markUnread: parsed.data.value },
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/follow-up", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = threadBooleanSchema.safeParse({ value: request.body?.followUpFlag });
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createThreadPreferenceEvent({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        eventType: "FollowUpFlagSet",
        payload: { followUpFlag: parsed.data.value },
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/notification-preferences", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = notificationPreferenceSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createNotificationPreferenceChange({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        preference: parsed.data,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/participants", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = participantSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createParticipantAdd({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        participantIds: parsed.data.participantIds,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.delete("/rooms/:roomId/participants/:participantId", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createParticipantRemove({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        participantId: request.params.participantId,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(200).json({ event });
  });

  router.post("/rooms/:roomId/leave", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createParticipantRemove({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        participantId: identity.userId,
        left: true,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(200).json({ event });
  });

  router.post("/rooms/:roomId/context-link", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = linkedContextSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createContextLink({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        linkedContext: parsed.data,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.post("/rooms/:roomId/assignment-membership", async (request, response) => {
    const identity = await requireRoomAccess(request, response);
    if (!identity) {
      return;
    }
    const parsed = assignmentSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createAssignmentMembershipUpdate({
        roomId: request.params.roomId,
        actorUserId: identity.userId,
        participantIds: parsed.data.participantIds,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.get("/templates", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const templates = await dependencies.store.listQuickTemplates(identity.userId, {
      scopeType: request.query.scopeType as "tenant" | "site" | "unit" | "department" | "team" | undefined,
      scopeId: request.query.scopeId as string | undefined,
      query: request.query.query as string | undefined
    });
    response.json({ templates });
  });

  router.post("/templates", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createTemplateEvent({
        actorUserId: identity.userId,
        eventType: "QuickMessageTemplateCreated",
        template: {
          ...parsed.data,
          tenantId: identity.tenantId
        },
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  router.patch("/templates/:templateId", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const parsed = templateSchema.safeParse({ ...request.body, id: request.params.templateId });
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createTemplateEvent({
        actorUserId: identity.userId,
        eventType: "QuickMessageTemplateUpdated",
        template: {
          ...parsed.data,
          tenantId: identity.tenantId
        },
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(200).json({ event });
  });

  router.get("/directory", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const users = await dependencies.store.searchDirectory({
      query: request.query.query as string | undefined,
      role: request.query.role as string | undefined,
      team: request.query.team as string | undefined,
      location: request.query.location as string | undefined,
      shift: request.query.shift as string | undefined
    });
    response.json({ users });
  });

  router.get("/audit-events", async (request, response) => {
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const auditEvents = await dependencies.store.listAuditEvents({
      threadId: request.query.threadId as string | undefined,
      actorUserId: request.query.actorUserId as string | undefined,
      eventType: request.query.eventType as string | undefined
    });
    response.json({ auditEvents });
  });

  router.post("/presence", async (request, response) => {
    const presence = (request.body?.presence as "online" | "offline" | "away") ?? "online";
    const identity = requireIdentity(request, response);
    if (!identity) {
      return;
    }
    const event = await emitEvent(
      response,
      dependencies.commands.createPresence({
        actorUserId: identity.userId,
        presence,
        idempotencyKey: String(request.headers["x-idempotency-key"] ?? uuidv4())
      })
    );
    if (!event) {
      return;
    }
    response.status(201).json({ event });
  });

  return router;
}
