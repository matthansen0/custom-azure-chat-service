import { expect, test } from "@playwright/test";

test("Pass 1 shell loads seeded chat rooms", async ({ page }) => {
  await page.goto("/?user=u1");

  await expect(page.getByText("Users")).toBeVisible();
  await expect(page.getByText("Rooms")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(page.getByText("Connection:", { exact: false })).toBeVisible();
  await expect(page.getByPlaceholder("Write a message")).toBeVisible();
  await expect(page.getByText("Members")).toBeVisible();
});