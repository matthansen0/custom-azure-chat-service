import { expect, test } from "@playwright/test";

test("Pass 1 shell loads seeded chat rooms", async ({ page }) => {
  await page.goto("/?user=u1");

  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(page.getByTitle("Connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("u1");
  await expect(page.getByPlaceholder("Type a new message... (use @ to mention)")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await expect(page.getByText("3 members")).toBeVisible();

  await page.getByRole("button", { name: "Teams" }).click();
  await expect(page.getByRole("heading", { name: "Teams", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Operations/ }).click();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();

  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByText("Recent", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Chat" }).click();
  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
});