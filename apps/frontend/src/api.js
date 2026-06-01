const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";
let activeSession = null;
function isSessionCurrent(userId) {
    if (!activeSession || activeSession.identity.userId !== userId) {
        return false;
    }
    return new Date(activeSession.identity.expiresUtc).getTime() - Date.now() > 30_000;
}
function headers(userId) {
    const nextHeaders = {
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
export async function demoLogin(userId) {
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
    const session = (await response.json());
    activeSession = session;
    return session;
}
export async function getRooms(userId) {
    const response = await fetch(`${apiBase}/rooms`, { headers: headers(userId) });
    const json = (await response.json());
    return json.rooms;
}
export async function getRoomsWithFilters(userId, options) {
    const url = new URL(`${apiBase}/rooms`, window.location.origin);
    if (options?.includeArchived) {
        url.searchParams.set("includeArchived", "true");
    }
    if (options?.includeHidden) {
        url.searchParams.set("includeHidden", "true");
    }
    const response = await fetch(url.toString(), { headers: headers(userId) });
    const json = (await response.json());
    return json.rooms;
}
export async function getRoomDetails(userId, roomId) {
    const response = await fetch(`${apiBase}/rooms/${roomId}`, { headers: headers(userId) });
    const json = (await response.json());
    return json.room;
}
export async function createRoom(userId, input) {
    const response = await fetch(`${apiBase}/rooms`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify(input)
    });
    const json = (await response.json());
    return json.roomId;
}
export async function deleteRoom(userId, roomId) {
    await fetch(`${apiBase}/rooms/${roomId}`, {
        method: "DELETE",
        headers: headers(userId)
    });
}
export async function clearRoom(userId, roomId) {
    await fetch(`${apiBase}/rooms/${roomId}/clear`, {
        method: "POST",
        headers: headers(userId)
    });
}
export async function getMessages(userId, roomId) {
    const response = await fetch(`${apiBase}/rooms/${roomId}/messages`, { headers: headers(userId) });
    const json = (await response.json());
    return json.messages;
}
export async function getMembers(userId, roomId) {
    const response = await fetch(`${apiBase}/rooms/${roomId}/members`, { headers: headers(userId) });
    const json = (await response.json());
    return json.members;
}
export async function sendMessage(userId, roomId, content, clientMessageId, options) {
    await fetch(`${apiBase}/rooms/${roomId}/messages`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({
            content,
            clientMessageId,
            mentions: options?.mentions,
            mentionEveryone: options?.mentionEveryone,
            priority: options?.priority,
            replyToMessageId: options?.replyToMessageId
        })
    });
}
export async function updateMessage(userId, roomId, messageId, content) {
    await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}`, {
        method: "PATCH",
        headers: headers(userId),
        body: JSON.stringify({ content })
    });
}
export async function deleteMessage(userId, roomId, messageId) {
    await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}`, {
        method: "DELETE",
        headers: headers(userId)
    });
}
export async function deliverMessage(userId, roomId, messageId) {
    await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/deliver`, {
        method: "POST",
        headers: headers(userId)
    });
}
export async function setMessagePriority(userId, roomId, messageId, priority) {
    await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/priority`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ priority })
    });
}
export async function setTyping(userId, roomId, started) {
    await fetch(`${apiBase}/rooms/${roomId}/typing`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ started })
    });
}
export async function markRead(userId, roomId, messageId) {
    await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/read`, {
        method: "POST",
        headers: headers(userId)
    });
}
export async function addReaction(userId, roomId, messageId, reaction) {
    await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ reaction })
    });
}
export async function removeReaction(userId, roomId, messageId, reaction) {
    await fetch(`${apiBase}/rooms/${roomId}/messages/${messageId}/reactions/${reaction}`, {
        method: "DELETE",
        headers: headers(userId)
    });
}
export async function setPin(userId, roomId, pinned) {
    await fetch(`${apiBase}/rooms/${roomId}/pin`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ pinned })
    });
}
export async function setThreadArchived(userId, roomId, archived) {
    await fetch(`${apiBase}/rooms/${roomId}/archive`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ archived })
    });
}
export async function setThreadHidden(userId, roomId, hidden) {
    await fetch(`${apiBase}/rooms/${roomId}/hide`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ hidden })
    });
}
export async function setThreadMarkUnread(userId, roomId, markUnread) {
    await fetch(`${apiBase}/rooms/${roomId}/mark-unread`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ markUnread })
    });
}
export async function setThreadFollowUp(userId, roomId, followUpFlag) {
    await fetch(`${apiBase}/rooms/${roomId}/follow-up`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ followUpFlag })
    });
}
export async function setNotificationPreference(userId, roomId, input) {
    await fetch(`${apiBase}/rooms/${roomId}/notification-preferences`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify(input)
    });
}
export async function addParticipants(userId, roomId, participantIds) {
    await fetch(`${apiBase}/rooms/${roomId}/participants`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ participantIds })
    });
}
export async function removeParticipant(userId, roomId, participantId) {
    await fetch(`${apiBase}/rooms/${roomId}/participants/${participantId}`, {
        method: "DELETE",
        headers: headers(userId)
    });
}
export async function leaveRoom(userId, roomId) {
    await fetch(`${apiBase}/rooms/${roomId}/leave`, {
        method: "POST",
        headers: headers(userId)
    });
}
export async function linkContext(userId, roomId, linkedContext) {
    await fetch(`${apiBase}/rooms/${roomId}/context-link`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify(linkedContext)
    });
}
export async function updateAssignmentMembership(userId, roomId, participantIds) {
    await fetch(`${apiBase}/rooms/${roomId}/assignment-membership`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify({ participantIds })
    });
}
export async function searchInRoom(userId, roomId, query) {
    const response = await fetch(`${apiBase}/rooms/${roomId}/search?query=${encodeURIComponent(query)}`, {
        headers: headers(userId)
    });
    const json = (await response.json());
    return json.messages;
}
export async function getTemplates(userId, filters) {
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
    const json = (await response.json());
    return json.templates;
}
export async function createTemplate(userId, template) {
    await fetch(`${apiBase}/templates`, {
        method: "POST",
        headers: headers(userId),
        body: JSON.stringify(template)
    });
}
export async function updateTemplate(userId, templateId, template) {
    await fetch(`${apiBase}/templates/${templateId}`, {
        method: "PATCH",
        headers: headers(userId),
        body: JSON.stringify(template)
    });
}
export async function getDirectory(userId, filters) {
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
    const json = (await response.json());
    return json.users;
}
export async function getAuditEvents(userId, filters) {
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
    const json = (await response.json());
    return json.auditEvents;
}
export async function negotiate(userId) {
    const url = new URL(`${apiBase}/realtime/negotiate`, window.location.origin);
    const authorizedResponse = await fetch(url.toString(), {
        headers: headers(userId)
    });
    if (!authorizedResponse.ok) {
        throw new Error(`Realtime negotiation failed with status ${authorizedResponse.status}`);
    }
    const json = (await authorizedResponse.json());
    return json;
}
