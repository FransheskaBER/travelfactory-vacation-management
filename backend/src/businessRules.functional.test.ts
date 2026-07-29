import { describe, expect, it } from "vitest";
import { isoDaysFromToday } from "./domain/commands/testSupport";

/**
 * Phase 5 — functional verification over HTTP: login, create-request happy
 * path, and one violation per business rule (PRD §5), asserting the wire
 * contract (root.yaml): status code + `{ error: { code, message } }`.
 *
 * Needs a running dev server and seeded users; skipped unless
 * FUNCTIONAL_BASE_URL is set, so a plain `npm test` never depends on one:
 *
 *   npx ts-node src/index.ts --local 8899        # terminal 1
 *   FUNCTIONAL_BASE_URL=http://localhost:8899 npm test   # terminal 2
 *
 * Self-contained by design: the suite creates its own far-future request and
 * violates the rules against that row, so it never assumes seed rows are in
 * their initial state. Net database effect: one extra Approved request for
 * the requester in a random 3-day window ~2 months–1 year out (`npm run seed`
 * restores the pristine demo state).
 */
const baseUrl = process.env.FUNCTIONAL_BASE_URL ?? "";

const REQUESTER_EMAIL = "alice.requester@demo.test";
const VALIDATOR_EMAIL = "carla.validator@demo.test";
const DEMO_PASSWORD = "Demo1234!";

interface ApiReply {
  status: number;
  body: Record<string, unknown>;
  setCookie: string | null;
}

const call = async (
  path: string,
  options: { method?: string; body?: object; cookie?: string } = {}
): Promise<ApiReply> => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    setCookie: response.headers.get("set-cookie"),
  };
};

const errorEnvelope = (code: string) => ({
  error: { code, message: expect.any(String) },
});

/** Extracts `token=...` from a Set-Cookie header into a Cookie header value. */
const cookieFrom = (reply: ApiReply): string => {
  const match = /token=[^;]+/.exec(reply.setCookie ?? "");
  if (!match) throw new Error("login response carried no token cookie");
  return match[0];
};

describe.skipIf(baseUrl === "")("Functional — business rules over HTTP", () => {
  // Random far-future window so reruns don't collide with rows created by
  // earlier runs (no delete endpoint exists to clean up after ourselves).
  const offset = 60 + Math.floor(Math.random() * 300);
  const start = isoDaysFromToday(offset);
  const end = isoDaysFromToday(offset + 2);

  let requesterCookie = "";
  let validatorCookie = "";
  let createdId = "";

  it("logs in the requester (happy path) — 200, role in body, httpOnly token cookie", async () => {
    const reply = await call("/login", {
      body: { email: REQUESTER_EMAIL, password: DEMO_PASSWORD },
    });

    expect(reply.status).toBe(200);
    expect(reply.body.role).toBe("Requester");
    expect(reply.setCookie).toContain("HttpOnly");
    requesterCookie = cookieFrom(reply);
  });

  it("creates a vacation request (happy path) — 201, status Pending", async () => {
    const reply = await call("/requests", {
      cookie: requesterCookie,
      body: { startDate: start, endDate: end, reason: "Phase 5 functional run" },
    });

    expect(reply.status).toBe(201);
    expect(reply.body.status).toBe("Pending");
    createdId = reply.body.id as string;
    expect(createdId).toBeTruthy();
  });

  it("Rule 1 violation — end before start → 400 INVALID_DATE_RANGE", async () => {
    const reply = await call("/requests", {
      cookie: requesterCookie,
      body: { startDate: end, endDate: start },
    });

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual(errorEnvelope("INVALID_DATE_RANGE"));
  });

  it("Rule 4 violation — start yesterday → 400 START_DATE_IN_PAST", async () => {
    const reply = await call("/requests", {
      cookie: requesterCookie,
      body: { startDate: isoDaysFromToday(-1), endDate: isoDaysFromToday(1) },
    });

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual(errorEnvelope("START_DATE_IN_PAST"));
  });

  it("Rule 2 violation — same range again for the same user → 409 OVERLAPPING_REQUEST", async () => {
    const reply = await call("/requests", {
      cookie: requesterCookie,
      body: { startDate: start, endDate: end },
    });

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual(errorEnvelope("OVERLAPPING_REQUEST"));
  });

  it("logs in the validator — 200 with Validator role", async () => {
    const reply = await call("/login", {
      body: { email: VALIDATOR_EMAIL, password: DEMO_PASSWORD },
    });

    expect(reply.status).toBe(200);
    expect(reply.body.role).toBe("Validator");
    validatorCookie = cookieFrom(reply);
  });

  it("Rule 5 violation — reject with blank comment → 400 COMMENT_REQUIRED", async () => {
    const reply = await call(`/requests/${createdId}/reject`, {
      cookie: validatorCookie,
      body: { comment: "   " },
    });

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual(errorEnvelope("COMMENT_REQUIRED"));
  });

  it("Rule 6 violation — requester calls approve → 403 FORBIDDEN", async () => {
    const reply = await call(`/requests/${createdId}/approve`, {
      cookie: requesterCookie,
    });

    expect(reply.status).toBe(403);
    expect(reply.body).toEqual(errorEnvelope("FORBIDDEN"));
  });

  it("validator approves the pending request (Rule 6 pass side) — 200, status Approved", async () => {
    const reply = await call(`/requests/${createdId}/approve`, {
      cookie: validatorCookie,
    });

    expect(reply.status).toBe(200);
    expect(reply.body.status).toBe("Approved");
  });

  it("Rule 3 violation — approve the now-Approved request again → 409 REQUEST_NOT_PENDING", async () => {
    const reply = await call(`/requests/${createdId}/approve`, {
      cookie: validatorCookie,
    });

    expect(reply.status).toBe(409);
    expect(reply.body).toEqual(errorEnvelope("REQUEST_NOT_PENDING"));
  });
});
