import { expect, test } from "@playwright/test";
import { deleteCreatedResource } from "./testHelpers.js";

test("Pass 3 users create, discover, and manage a shared room", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const participantContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const participantPage = await participantContext.newPage();
  const roomName = `Pass3 Room ${Date.now()}`;
  const messageText = `Message in ${roomName}`;
  let createdRoom: { response: Awaited<ReturnType<typeof adminPage.waitForResponse>>; id: string } | undefined;

  try {
    await adminPage.goto("/?user=u1");
    await participantPage.goto("/?user=u2");
    await expect(adminPage.getByTitle("Connected")).toBeVisible();
    await expect(participantPage.getByTitle("Connected")).toBeVisible();

    await adminPage.getByTitle("New chat").click();
    await adminPage.getByLabel("Chat name").fill(roomName);
    await adminPage.getByRole("checkbox", { name: "Jordan" }).check();
    const createResponsePromise = adminPage.waitForResponse((response) =>
      response.url().endsWith("/api/rooms") && response.request().method() === "POST"
    );
    await adminPage.getByRole("button", { name: "Create", exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const createBody = (await createResponse.json()) as { roomId: string };
    createdRoom = { response: createResponse, id: createBody.roomId };

    await expect(adminPage.getByRole("heading", { name: roomName })).toBeVisible();
    await participantPage.getByRole("button", { name: "Teams" }).click();
    await expect(participantPage.getByRole("heading", { name: "Teams", exact: true })).toBeVisible();
    const teamCard = participantPage.getByRole("button", { name: new RegExp(roomName) });
    await expect(teamCard).toBeVisible({ timeout: 10_000 });
    await teamCard.click();
    await expect(participantPage.getByRole("heading", { name: roomName })).toBeVisible();
    await expect(participantPage.getByText("Jordan (you)")).toBeVisible();
    await expect(participantPage.locator(".member-row").filter({ hasText: "Alex" })).toBeVisible();

    await adminPage.getByPlaceholder("Type a new message... (use @ to mention)").fill(messageText);
    const sendResponsePromise = adminPage.waitForResponse((response) =>
      response.url().endsWith(`/api/rooms/${createdRoom!.id}/messages`) &&
      response.request().method() === "POST"
    );
    await adminPage.getByTitle("Send").click();
    const sendResponse = await sendResponsePromise;
    expect(sendResponse.status()).toBe(201);
    await expect(
      participantPage.locator(".message-bubble").filter({ hasText: messageText })
    ).toBeVisible({ timeout: 10_000 });

    const message = adminPage.locator(".message-bubble").filter({ hasText: messageText });
    await message.hover();
    await message.getByTitle("Edit").click();
    const updatedText = `${messageText} updated`;
    await message.getByRole("textbox").fill(updatedText);
    await message.getByRole("button", { name: "Save" }).click();
    await expect(
      participantPage.locator(".message-bubble").filter({ hasText: updatedText })
    ).toBeVisible({ timeout: 10_000 });

    await message.hover();
    await message.getByTitle("Delete").click();
    await expect(participantPage.getByText("This message has been deleted")).toBeVisible({ timeout: 10_000 });
  } finally {
    if (createdRoom) {
      await deleteCreatedResource(adminPage, createdRoom.response, createdRoom.id);
    }
    await adminContext.close();
    await participantContext.close();
  }
});