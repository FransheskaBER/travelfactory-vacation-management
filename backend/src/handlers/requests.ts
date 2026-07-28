import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { Response } from "commoneventframework";
import { FindOptionsWhere } from "typeorm";
import { InputParserFn, HandlerFn } from "./types";
import { errorResponse } from "../errors/toErrorResponse";
import { getDataSource } from "../db/dataSource";
import { requireRole } from "../auth/requireRole";
import { UserRole } from "../entities/User";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../entities/VacationRequest";
import { VacationRequestRepository } from "../repositories/VacationRequestRepository";
import { TypeOrmVacationRequestRepository } from "../repositories/TypeOrmVacationRequestRepository";
import {
  CreateVacationRequestCommand,
  CreateVacationRequestInput,
} from "../domain/commands/CreateVacationRequestCommand";
import {
  ApproveVacationRequestCommand,
  ApproveVacationRequestInput,
} from "../domain/commands/ApproveVacationRequestCommand";
import {
  RejectVacationRequestCommand,
  RejectVacationRequestInput,
} from "../domain/commands/RejectVacationRequestCommand";
import { commandBus } from "../domain/bus/CommandBus";

// --- shared shape helpers (spec 4.6 §4, §8 Q7/Q8) ---

// Strict YYYY-MM-DD: regex + round-trip rebuild. Never new Date(string) —
// an invalid string yields Invalid Date → NaN → every downstream rule
// comparison silently returns false (backend.md ban, spec 4.6 §8 Q7).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateString = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const rebuilt = new Date(Date.UTC(y, m - 1, d));
  return (
    rebuilt.getUTCFullYear() === y &&
    rebuilt.getUTCMonth() === m - 1 &&
    rebuilt.getUTCDate() === d
  );
};

// Format is shape for a declared-uuid param: 400 here keeps 404 meaning
// "well-formed id, no such row" and keeps Postgres cast errors (500s)
// unreachable (spec 4.6 §8 Q8).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_RE.test(value);

const parseJsonObjectBody = (event: CommonEvent): Record<string, unknown> | Response => {
  let body: unknown;
  try {
    body = JSON.parse(event.body ?? "");
  } catch {
    return errorResponse(400, "INVALID_INPUT", "Body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse(400, "INVALID_INPUT", "Body must be a JSON object");
  }
  return body as Record<string, unknown>;
};

// Commands take the one repository port; built per request off the shared
// DataSource, same lazy pattern as auth.ts's findUserByEmail.
const requestsPort = async (): Promise<VacationRequestRepository> => {
  const ds = await getDataSource();
  return new TypeOrmVacationRequestRepository(ds.getRepository(VacationRequest));
};

// --- POST /requests ---

export const parseCreateRequestInput: InputParserFn = (event: CommonEvent) => {
  const body = parseJsonObjectBody(event);
  if (body instanceof Response) return body;
  const { startDate, endDate, reason } = body;
  if (typeof startDate !== "string" || !isValidDateString(startDate)) {
    return errorResponse(400, "INVALID_INPUT", "startDate must be a valid YYYY-MM-DD date");
  }
  if (typeof endDate !== "string" || !isValidDateString(endDate)) {
    return errorResponse(400, "INVALID_INPUT", "endDate must be a valid YYYY-MM-DD date");
  }
  if (reason !== undefined && reason !== null && typeof reason !== "string") {
    return errorResponse(400, "INVALID_INPUT", "reason must be a string when provided");
  }
  // reason passes through as received — 4.7 owns normalization (spec 4.6 §5).
  return { startDate, endDate, reason };
};

export const createRequest: HandlerFn = requireRole(
  UserRole.Requester,
  async (input: CreateVacationRequestInput) => {
    const saved = await commandBus.execute(
      new CreateVacationRequestCommand({ requests: await requestsPort() }),
      input
    );
    // The one non-200 success: index.ts passes Responses through (§8 Q3).
    return new Response(201, saved);
  }
);

// --- GET /requests (validator dashboard) ---

interface DashboardInput {
  actorId: string;
  status?: VacationRequestStatus;
  page: number;
  limit: number;
  userId?: string;
}

const STATUS_VALUES = Object.values(VacationRequestStatus) as string[];

// The guarantee covers the full range the output type carries downstream,
// not just plausible values: an unbounded digits-only page becomes
// skip ≈ page*limit past Postgres's bigint ceiling → driver error → 500
// from curlable input, the §8 Q8 failure class (spec 4.6 §9, audit item 2).
const parsePositiveInt = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
};

export const parseDashboardInput: InputParserFn = (event: CommonEvent) => {
  const q = event.queryStringParameters ?? {};
  const out: Omit<DashboardInput, "actorId"> = { page: 1, limit: 10 };

  if (q.status !== undefined) {
    if (!STATUS_VALUES.includes(q.status)) {
      return errorResponse(400, "INVALID_INPUT", "status must be Pending, Approved or Rejected");
    }
    out.status = q.status as VacationRequestStatus;
  }
  if (q.userId !== undefined) {
    if (!isUuid(q.userId)) {
      return errorResponse(400, "INVALID_INPUT", "userId must be a uuid");
    }
    out.userId = q.userId;
  }
  if (q.page !== undefined) {
    const page = parsePositiveInt(q.page);
    if (page === null) {
      return errorResponse(400, "INVALID_INPUT", "page must be an integer >= 1");
    }
    out.page = page;
  }
  if (q.limit !== undefined) {
    const limit = parsePositiveInt(q.limit);
    if (limit === null) {
      return errorResponse(400, "INVALID_INPUT", "limit must be an integer >= 1");
    }
    // Over-asking is a benign preference, not malformed input (§8 Q4).
    out.limit = Math.min(limit, 100);
  }
  return out;
};

export const getDashboard: HandlerFn = requireRole(
  UserRole.Validator,
  async (input: DashboardInput) => {
    const ds = await getDataSource();
    const where: FindOptionsWhere<VacationRequest> = {};
    if (input.status !== undefined) where.status = input.status;
    if (input.userId !== undefined) where.userId = input.userId;
    // Bare uuids by design — name resolution is 4.10's, client-side via
    // GET /users (spec 4.6 §8 Q10).
    const [data, total] = await ds.getRepository(VacationRequest).findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    });
    return { data, total, page: input.page, limit: input.limit };
  }
);

// --- GET /requests/mine ---

export const listMyRequests: HandlerFn = requireRole(
  UserRole.Requester,
  async (input: { actorId: string }) => {
    const ds = await getDataSource();
    return ds.getRepository(VacationRequest).find({
      where: { userId: input.actorId },
      order: { createdAt: "DESC" },
    });
  }
);

// --- GET /requests/team ---

export const listTeamVacations: HandlerFn = requireRole("any", async () => {
  const ds = await getDataSource();
  const approved = await ds.getRepository(VacationRequest).find({
    where: { status: VacationRequestStatus.Approved },
    relations: { requester: true },
    order: { startDate: "ASC", id: "ASC" },
  });
  // Projection is the privacy boundary: name + dates only, never reason,
  // never raw entities with a joined User (A14/A10, spec 4.6 §4).
  return approved.map((r) => ({
    requesterName: r.requester.name,
    startDate: r.startDate,
    endDate: r.endDate,
  }));
});

// --- POST /requests/:id/approve ---

export const parseRequestIdInput: InputParserFn = (event: CommonEvent) => {
  const id = event.pathParameters?.id;
  if (typeof id !== "string" || !isUuid(id)) {
    return errorResponse(400, "INVALID_INPUT", "id must be a uuid");
  }
  return { id };
};

export const approveRequest: HandlerFn = requireRole(
  UserRole.Validator,
  async (input: ApproveVacationRequestInput) =>
    commandBus.execute(
      new ApproveVacationRequestCommand({ requests: await requestsPort() }),
      input
    )
);

// --- POST /requests/:id/reject ---

export const parseRejectInput: InputParserFn = (event: CommonEvent) => {
  const id = event.pathParameters?.id;
  if (typeof id !== "string" || !isUuid(id)) {
    return errorResponse(400, "INVALID_INPUT", "id must be a uuid");
  }
  const body = parseJsonObjectBody(event);
  if (body instanceof Response) return body;
  const { comment } = body;
  if (typeof comment !== "string") {
    return errorResponse(400, "INVALID_INPUT", "comment must be a string");
  }
  // Trimmed-emptiness is the command's Rule 5, not shape (4.4 §8 Q7).
  return { id, comment };
};

export const rejectRequest: HandlerFn = requireRole(
  UserRole.Validator,
  async (input: RejectVacationRequestInput) =>
    commandBus.execute(
      new RejectVacationRequestCommand({ requests: await requestsPort() }),
      input
    )
);
