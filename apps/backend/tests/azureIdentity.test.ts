import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { DefaultAzureCredential } from "@azure/identity";

test("the default credential acquires managed identity tokens for Azure services", { timeout: 10_000 }, async (t) => {
  const identityVariables = /^(AZURE_|IDENTITY_|MSI_)/;
  const savedVariables = Object.entries(process.env).filter(
    (entry): entry is [string, string] => identityVariables.test(entry[0]) && entry[1] !== undefined
  );
  const savedNoProxy = process.env.NO_PROXY;
  for (const [key] of savedVariables) {
    delete process.env[key];
  }
  t.after(() => {
    for (const key of Object.keys(process.env)) {
      if (identityVariables.test(key)) delete process.env[key];
    }
    for (const [key, value] of savedVariables) {
      process.env[key] = value;
    }
    if (savedNoProxy === undefined) delete process.env.NO_PROXY;
    else process.env.NO_PROXY = savedNoProxy;
  });

  const requests: Array<{
    path: string;
    resource: string | null;
    version: string | null;
    header: string | string[] | undefined;
    clientId: string | null;
  }> = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const resource = url.searchParams.get("resource");
    requests.push({
      path: url.pathname,
      resource,
      version: url.searchParams.get("api-version"),
      header: request.headers["x-identity-header"],
      clientId: url.searchParams.get("client_id")
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      access_token: `local-token-${requests.length}`,
      expires_on: String(Math.floor(Date.now() / 1000) + 3600),
      resource,
      token_type: "Bearer"
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected an ephemeral TCP port");
  }

  process.env.IDENTITY_ENDPOINT = `http://127.0.0.1:${address.port}/identity`;
  process.env.IDENTITY_HEADER = "local-test-header";
  process.env.AZURE_TOKEN_CREDENTIALS = "prod";
  process.env.NO_PROXY = "127.0.0.1,localhost";

  const resources = [
    "https://validation.documents.azure.com",
    "https://cosmos.azure.com",
    "https://webpubsub.azure.com"
  ];
  const credential = new DefaultAzureCredential();
  for (const resource of resources) {
    const token = await credential.getToken(`${resource}/.default`);
    assert.match(token.token, /^local-token-/);
    assert.ok(token.expiresOnTimestamp > Date.now());
  }
  assert.deepEqual(requests.map((request) => request.resource), resources);
  for (const request of requests) {
    assert.equal(request.path, "/identity");
    assert.equal(request.header, "local-test-header");
    assert.equal(request.clientId, null);
    assert.match(request.version ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.ok((request.version ?? "") >= "2019-08-01");
  }
});
