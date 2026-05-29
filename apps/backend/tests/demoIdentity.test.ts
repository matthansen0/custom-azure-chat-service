import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { issueDemoIdentityToken, resolveDemoIdentity, verifyDemoIdentityToken } from "../src/auth/demoIdentity.js";

const secret = "unit-test-secret";

function createRequest(headers: Record<string, string | undefined>): Request {
  return { headers } as Request;
}

test("issueDemoIdentityToken creates a verifiable token", () => {
  const issued = issueDemoIdentityToken({
    tenantId: "tenant-a",
    userId: "u1",
    displayName: "Alex",
    roleNames: ["dispatcher"],
    secret,
    ttlMinutes: 30
  });

  const verified = verifyDemoIdentityToken(issued.token, secret);

  assert.ok(verified);
  assert.equal(verified.tenantId, "tenant-a");
  assert.equal(verified.userId, "u1");
  assert.deepEqual(verified.roleNames, ["dispatcher"]);
});

test("verifyDemoIdentityToken rejects a tampered token", () => {
  const issued = issueDemoIdentityToken({
    tenantId: "tenant-a",
    userId: "u1",
    displayName: "Alex",
    roleNames: ["dispatcher"],
    secret,
    ttlMinutes: 30
  });

  const tampered = `${issued.token.slice(0, -1)}x`;

  assert.equal(verifyDemoIdentityToken(tampered, secret), null);
});

test("resolveDemoIdentity prefers bearer tokens over fallback headers", () => {
  const issued = issueDemoIdentityToken({
    tenantId: "tenant-b",
    userId: "u2",
    displayName: "Jordan",
    roleNames: ["responder"],
    secret,
    ttlMinutes: 30
  });

  const request = createRequest({
    authorization: `Bearer ${issued.token}`,
    "x-demo-user": "u1",
    "x-demo-tenant": "tenant-demo"
  });

  const identity = resolveDemoIdentity(request, {
    secret,
    defaultTenantId: "tenant-demo",
    allowHeaderFallback: true
  });

  assert.ok(identity);
  assert.equal(identity.userId, "u2");
  assert.equal(identity.tenantId, "tenant-b");
});

test("resolveDemoIdentity falls back to demo headers when allowed", () => {
  const request = createRequest({
    "x-demo-user": "u3",
    "x-demo-tenant": "tenant-c"
  });

  const identity = resolveDemoIdentity(request, {
    secret,
    defaultTenantId: "tenant-demo",
    allowHeaderFallback: true
  });

  assert.ok(identity);
  assert.equal(identity.userId, "u3");
  assert.equal(identity.tenantId, "tenant-c");
});

test("resolveDemoIdentity returns null when no auth path is available", () => {
  const request = createRequest({});

  const identity = resolveDemoIdentity(request, {
    secret,
    defaultTenantId: "tenant-demo",
    allowHeaderFallback: false
  });

  assert.equal(identity, null);
});