import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

export interface DemoIdentity {
  tenantId: string;
  userId: string;
  displayName: string;
  roleNames: string[];
  expiresUtc: string;
}

type DemoTokenPayload = {
  tenantId: string;
  userId: string;
  displayName: string;
  roleNames: string[];
  exp: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(unsignedToken: string, secret: string): string {
  return createHmac("sha256", secret).update(unsignedToken).digest("base64url");
}

export function issueDemoIdentityToken(input: {
  tenantId: string;
  userId: string;
  displayName: string;
  roleNames: string[];
  secret: string;
  ttlMinutes: number;
}): { token: string; identity: DemoIdentity } {
  const now = Date.now();
  const payload: DemoTokenPayload = {
    tenantId: input.tenantId,
    userId: input.userId,
    displayName: input.displayName,
    roleNames: input.roleNames,
    exp: now + input.ttlMinutes * 60_000
  };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${header}.${body}`;
  const signature = sign(unsignedToken, input.secret);

  return {
    token: `${unsignedToken}.${signature}`,
    identity: {
      tenantId: payload.tenantId,
      userId: payload.userId,
      displayName: payload.displayName,
      roleNames: payload.roleNames,
      expiresUtc: new Date(payload.exp).toISOString()
    }
  };
}

export function verifyDemoIdentityToken(token: string, secret: string): DemoIdentity | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const expectedSignature = sign(`${header}.${body}`, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(body)) as DemoTokenPayload;
  if (payload.exp <= Date.now()) {
    return null;
  }

  return {
    tenantId: payload.tenantId,
    userId: payload.userId,
    displayName: payload.displayName,
    roleNames: payload.roleNames,
    expiresUtc: new Date(payload.exp).toISOString()
  };
}

export function resolveDemoIdentity(
  request: Request,
  options: {
    secret: string;
    defaultTenantId: string;
    allowHeaderFallback?: boolean;
  }
): DemoIdentity | null {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    return verifyDemoIdentityToken(authorization.slice("Bearer ".length), options.secret);
  }

  if (options.allowHeaderFallback !== false) {
    const userId = (request.headers["x-demo-user"] as string | undefined) ?? "u1";
    const tenantId = (request.headers["x-demo-tenant"] as string | undefined) ?? options.defaultTenantId;
    return {
      tenantId,
      userId,
      displayName: userId,
      roleNames: ["demo-user"],
      expiresUtc: new Date(Date.now() + 15 * 60_000).toISOString()
    };
  }

  return null;
}