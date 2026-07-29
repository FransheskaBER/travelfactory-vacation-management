import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { beforeAll, describe, expect, it } from "vitest";
import { requireRole } from "./requireRole";
import { signJwt } from "./jwt";
import { UserRole } from "../entities/User";

/**
 * Phase 5 — Business Rule 6 (PRD §5): "Only validators can approve or reject
 * requests." Enforced at the requireRole guard (ADR 0003), not in commands —
 * tested here as a plain function per the Phase 5 brief. PRD §7: a Requester
 * calling approve/reject fails with 403.
 */
describe("requireRole — Rule 6, validator-only actions", () => {
  beforeAll(() => {
    // jwt.ts reads the secret at call time, so setting it here covers both
    // signing in the tests and verification inside the guard.
    process.env.JWT_SECRET = "phase5-rule6-test-secret";
  });

  const eventWithCookie = (token: string | null): CommonEvent =>
    ({
      headers: token ? { cookie: `token=${token}` } : {},
    } as unknown as CommonEvent);

  interface SeenInput {
    actorId?: string;
  }

  /** Stub domain handler that records whether/what it was called with. */
  const makeStub = () => {
    const calls: SeenInput[] = [];
    const handler = async (input: SeenInput): Promise<object> => {
      calls.push(input);
      return { ok: true };
    };
    return { calls, handler };
  };

  const asTransportResponse = (value: unknown): { statusCode: number; body: string } => {
    if (
      typeof value === "object" &&
      value !== null &&
      "statusCode" in value &&
      "body" in value
    ) {
      return value as { statusCode: number; body: string };
    }
    throw new Error("expected a transport-level Response");
  };

  it("lets a Validator through to the wrapped handler, with actorId taken from the verified JWT", async () => {
    const { calls, handler } = makeStub();
    const guarded = requireRole(UserRole.Validator, handler);
    const issued = signJwt({ userId: "validator-1", role: UserRole.Validator });

    const result = await guarded({}, eventWithCookie(issued.token));

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].actorId).toBe("validator-1");
  });

  it("blocks a Requester with 403 FORBIDDEN and never invokes the handler", async () => {
    const { calls, handler } = makeStub();
    const guarded = requireRole(UserRole.Validator, handler);
    const issued = signJwt({ userId: "requester-1", role: UserRole.Requester });

    const result = await guarded({}, eventWithCookie(issued.token));

    const response = asTransportResponse(result);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({
      error: { code: "FORBIDDEN", message: "Insufficient role" },
    });
    expect(calls).toHaveLength(0);
  });

  it("blocks an unauthenticated caller with 401 and never invokes the handler", async () => {
    const { calls, handler } = makeStub();
    const guarded = requireRole(UserRole.Validator, handler);

    const result = await guarded({}, eventWithCookie(null));

    const response = asTransportResponse(result);
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error.code).toBe("UNAUTHORIZED");
    expect(calls).toHaveLength(0);
  });
});
