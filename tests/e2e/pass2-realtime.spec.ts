import { expect, test } from "@playwright/test";
import { deleteCreatedResource } from "./testHelpers.js";

test("Pass 2 users type, exchange messages, react, reply, and see read receipts", async ({ browser }) => {
  const leftContext = await browser.newContext();
  const rightContext = await browser.newContext();
  const leftPage = await leftContext.newPage();
  const rightPage = await rightContext.newPage();
  const messageText = `pass2-${Date.now()}-needle`;
  const replyText = `pass2-reply-${Date.now()}`;
  let createdMessage: { response: Awaited<ReturnType<typeof leftPage.waitForResponse>>; id: string } | undefined;
  let createdReply: { response: Awaited<ReturnType<typeof rightPage.waitForResponse>>; id: string } | undefined;

  try {
    await leftPage.goto("/?user=u1");
    await rightPage.goto("/?user=u2");
    await expect(leftPage.getByRole("heading", { name: "Operations" })).toBeVisible();
    await expect(rightPage.getByRole("heading", { name: "Operations" })).toBeVisible();
    await expect(leftPage.getByTitle("Connected")).toBeVisible();
    await expect(rightPage.getByTitle("Connected")).toBeVisible();

    const typingResponsePromise = leftPage.waitForResponse((response) =>
      response.url().endsWith("/api/rooms/r-ops/typing") && response.request().method() === "POST"
    );
    await leftPage.getByPlaceholder("Type a new message... (use @ to mention)").fill("typing preview");
    const typingResponse = await typingResponsePromise;
    expect(typingResponse.status()).toBe(201);
    const typingBody = (await typingResponse.json()) as { event: { eventType: string; roomId: string } };
    expect(typingBody.event).toMatchObject({ eventType: "TypingStarted", roomId: "r-ops" });
    await expect(rightPage.getByText("Alex is typing...")).toBeVisible({ timeout: 10_000 });

    await leftPage.getByPlaceholder("Type a new message... (use @ to mention)").fill(messageText);
    const messageResponsePromise = leftPage.waitForResponse((response) =>
      response.url().endsWith("/api/rooms/r-ops/messages") && response.request().method() === "POST"
    );
    await leftPage.getByTitle("Send").click();
    const messageResponse = await messageResponsePromise;
    expect(messageResponse.status()).toBe(201);
    const messageBody = (await messageResponse.json()) as { event: { entityId: string } };
    createdMessage = { response: messageResponse, id: messageBody.event.entityId };

    const leftMessage = leftPage.locator(".message-bubble").filter({ hasText: messageText });
    const rightMessage = rightPage.locator(".message-bubble").filter({ hasText: messageText });
    await expect(leftMessage).toBeVisible();
    await expect(rightMessage).toBeVisible({ timeout: 10_000 });
    await expect(leftMessage.getByTitle("Seen by Jordan")).toBeVisible({ timeout: 10_000 });

    await rightMessage.hover();
    await rightMessage.getByTitle("React 👍").click();
    await expect(leftMessage.getByRole("button", { name: "👍 1" })).toBeVisible({ timeout: 10_000 });

    await rightMessage.getByTitle("Reply").click();
    await expect(rightPage.getByText(/Replying to Alex/)).toBeVisible();
    await rightPage.getByPlaceholder("Type a new message... (use @ to mention)").fill(replyText);
    const replyResponsePromise = rightPage.waitForResponse((response) =>
      response.url().endsWith("/api/rooms/r-ops/messages") && response.request().method() === "POST"
    );
    await rightPage.getByTitle("Send").click();
    const replyResponse = await replyResponsePromise;
    expect(replyResponse.status()).toBe(201);
    const replyBody = (await replyResponse.json()) as {
      event: { entityId: string; payload: { replyToMessageId: string } };
    };
    createdReply = { response: replyResponse, id: replyBody.event.entityId };
    expect(replyBody.event.payload.replyToMessageId).toBe(createdMessage.id);
    await expect(
      leftPage.locator(".message-bubble").filter({ hasText: replyText })
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    if (createdReply) {
      await deleteCreatedResource(rightPage, createdReply.response, createdReply.id);
    }
    if (createdMessage) {
      await deleteCreatedResource(leftPage, createdMessage.response, createdMessage.id);
    }
    await leftContext.close();
    await rightContext.close();
  }
});