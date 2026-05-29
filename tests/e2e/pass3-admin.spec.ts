import { expect, test } from "@playwright/test";

test("Pass 3 admin and lifecycle flows work through the UI", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const participantContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const participantPage = await participantContext.newPage();
  const roomName = `Pass3 Room ${Date.now()}`;
  const templateTitle = `Need backup ${Date.now()}`;
  const templateBody = `Requesting backup for ${roomName}`;

  await adminPage.goto("/?user=u1");
  await expect(adminPage.getByText("Connection: connected")).toBeVisible({ timeout: 10_000 });

  await adminPage.getByPlaceholder("Search people").fill("Jordan");
  await adminPage.getByRole("button", { name: "Select" }).first().click();
  await adminPage.getByPlaceholder("Room name").fill(roomName);
  await adminPage.getByRole("button", { name: "Create room" }).click();

  await expect(adminPage.getByRole("heading", { name: roomName })).toBeVisible({ timeout: 10_000 });

  await participantPage.goto("/?user=u2");
  await expect(participantPage.getByRole("button", { name: new RegExp(roomName) })).toBeVisible({ timeout: 10_000 });

  await adminPage.getByPlaceholder("Search people").fill("Sam");
  await adminPage.getByRole("button", { name: "Add" }).first().click();
  await expect(adminPage.locator(".memberRow").filter({ hasText: "Sam" })).toBeVisible({ timeout: 10_000 });

  await adminPage.getByPlaceholder("Context id").fill("incident-100");
  await adminPage.getByPlaceholder("Context label").fill("Incident 100");
  await adminPage.getByRole("button", { name: "Link context" }).click();
  await expect(adminPage.getByText("Context: Incident 100")).toBeVisible({ timeout: 10_000 });

  await adminPage.getByPlaceholder("Template title").fill(templateTitle);
  await adminPage.getByPlaceholder("Template body").fill(templateBody);
  await adminPage.getByRole("button", { name: "Create template" }).click();
  await expect(adminPage.getByRole("button", { name: templateTitle })).toBeVisible({ timeout: 10_000 });

  await adminPage.getByRole("button", { name: templateTitle }).click();
  await expect(adminPage.getByPlaceholder("Write a message")).toHaveValue(templateBody);
  await adminPage.getByRole("button", { name: "Send" }).click();

  const messageCard = adminPage.locator(".message").filter({ hasText: templateBody });
  await expect(messageCard).toBeVisible({ timeout: 10_000 });

  await messageCard.getByRole("button", { name: "Edit" }).click();
  await adminPage.locator(".inlineEditor input").fill(`${templateBody} updated`);
  await adminPage.getByRole("button", { name: "Save" }).click();
  await expect(adminPage.locator(".message").filter({ hasText: `${templateBody} updated` })).toBeVisible({ timeout: 10_000 });

  const updatedMessage = adminPage.locator(".message").filter({ hasText: `${templateBody} updated` });
  await updatedMessage.getByRole("button", { name: "Urgent" }).click();
  await expect(updatedMessage.getByText("Priority: urgent")).toBeVisible({ timeout: 10_000 });
  await updatedMessage.getByRole("button", { name: "Delete" }).click();
  await expect(adminPage.locator(".message").filter({ hasText: "Message deleted" })).toBeVisible({ timeout: 10_000 });

  await adminPage.getByRole("button", { name: "Follow-up" }).click();
  await expect(adminPage.getByText("Follow-up: On")).toBeVisible({ timeout: 10_000 });
  await adminPage.getByRole("button", { name: "Hide" }).click();
  await expect(adminPage.getByRole("button", { name: new RegExp(roomName) })).toHaveCount(0);
  await adminPage.getByLabel("Show hidden").check();
  await expect(adminPage.getByRole("button", { name: new RegExp(roomName) })).toBeVisible({ timeout: 10_000 });

  await expect(adminPage.getByText("ThreadCreated")).toBeVisible({ timeout: 10_000 });
  await expect(adminPage.getByText("ContextLinkedToThread")).toBeVisible({ timeout: 10_000 });

  await adminContext.close();
  await participantContext.close();
});