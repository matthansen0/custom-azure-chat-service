import { expect, type Page, type Response } from "@playwright/test";

export async function deleteCreatedResource(page: Page, response: Response, id: string): Promise<void> {
  const authorization = response.request().headers().authorization;
  if (!authorization) {
    throw new Error("Expected an authorization header on the create request");
  }

  const deletion = await page.request.delete(`${response.url()}/${encodeURIComponent(id)}`, {
    headers: { Authorization: authorization }
  });
  expect(deletion.status()).toBe(200);
}
