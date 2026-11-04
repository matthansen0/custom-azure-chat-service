import { expect, test } from "@playwright/test";

test("the current chat shell loads and connects", async ({ page }) => {
  await page.goto("/?user=u1");

  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(page.getByTitle("Connected")).toBeVisible();
  await expect(page.getByPlaceholder("Type a new message... (use @ to mention)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
});

test("two users exchange messages and reactions in real time", async ({ browser }) => {
  const leftContext = await browser.newContext();
  const rightContext = await browser.newContext();

  try {
    const leftPage = await leftContext.newPage();
    const rightPage = await rightContext.newPage();
    const message = `Dependency validation ${Date.now()}`;

    await leftPage.goto("/?user=u1");
    await rightPage.goto("/?user=u2");
    await expect(leftPage.getByTitle("Connected")).toBeVisible();
    await expect(rightPage.getByTitle("Connected")).toBeVisible();
    await expect(leftPage.getByRole("heading", { name: "Operations" })).toBeVisible();
    await expect(rightPage.getByRole("heading", { name: "Operations" })).toBeVisible();

    await leftPage.getByPlaceholder("Type a new message... (use @ to mention)").fill(message);
    await leftPage.getByTitle("Send").click();

    const leftMessage = leftPage.locator(".message-bubble").filter({ hasText: message });
    const rightMessage = rightPage.locator(".message-bubble").filter({ hasText: message });
    await expect(leftMessage).toBeVisible();
    await expect(rightMessage).toBeVisible({ timeout: 10_000 });
    await rightMessage.hover();
    await rightMessage.getByTitle("React \u{1f44d}").click();
    await expect(leftMessage.getByRole("button", { name: "\u{1f44d} 1" })).toBeVisible({ timeout: 10_000 });
  } finally {
    await leftContext.close();
    await rightContext.close();
  }
});

test("the current UI creates a room with default metadata", async ({ page }) => {
  const roomName = `Dependency room ${Date.now()}`;
  await page.goto("/?user=u1");
  await expect(page.getByTitle("Connected")).toBeVisible();
  await page.getByTitle("New chat").click();
  await page.getByLabel("Chat name").fill(roomName);
  await page.getByRole("checkbox", { name: "Jordan" }).check();

  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/rooms") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { event: { payload: { metadata: unknown } } };
  expect(body.event.payload.metadata).toEqual({});
  await expect(page.getByRole("heading", { name: roomName })).toBeVisible();
});
