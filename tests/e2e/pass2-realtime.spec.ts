import { expect, test } from "@playwright/test";

test("Pass 2 multi-user realtime flow works end to end", async ({ browser }) => {
  const leftContext = await browser.newContext();
  const rightContext = await browser.newContext();
  const leftPage = await leftContext.newPage();
  const rightPage = await rightContext.newPage();
  const messageText = `pass2-${Date.now()}-needle`;

  await leftPage.goto("/?user=u1");
  await rightPage.goto("/?user=u2");

  await expect(leftPage.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(rightPage.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(leftPage.getByText("Connection: connected")).toBeVisible({ timeout: 10_000 });
  await expect(rightPage.getByText("Connection: connected")).toBeVisible({ timeout: 10_000 });

  await leftPage.getByPlaceholder("Write a message").fill("typing preview");
  await expect(rightPage.locator(".typingIndicator")).toContainText("Alex typing...", { timeout: 10_000 });

  await leftPage.getByPlaceholder("Write a message").fill(messageText);
  await leftPage.getByRole("button", { name: "Send" }).click();

  const leftMessage = leftPage.locator(".message").filter({ hasText: messageText });
  const rightMessage = rightPage.locator(".message").filter({ hasText: messageText });

  await expect(rightMessage).toBeVisible({ timeout: 10_000 });
  await expect(leftMessage.getByRole("button", { name: /Mark Read \(2\)/ })).toBeVisible({ timeout: 10_000 });

  await rightMessage.getByRole("button", { name: /Heart/ }).click();
  await expect(leftMessage.getByRole("button", { name: /Heart \(1\)/ })).toBeVisible({ timeout: 10_000 });

  await leftPage.getByRole("button", { name: "Pin" }).click();
  await expect(leftPage.getByRole("button", { name: /Operations/ })).toContainText("Pinned", { timeout: 10_000 });

  await leftPage.getByPlaceholder("Search current room").fill("needle");
  await expect(leftMessage).toBeVisible({ timeout: 10_000 });

  await leftContext.close();
  await rightContext.close();
});