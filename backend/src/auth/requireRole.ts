import { HandlerFn } from "../handlers/types";
import { errorResponse } from "../errors/toErrorResponse";
import { UserRole } from "../entities/User";
import { verifyJwt } from "./jwt";
import { readTokenFromCookie } from "./cookie";

/**
 * Authorization wrapper applied at export time around each protected domain
 * handler (ADR 0003). CEF calls the wrapped export like any HandlerFn.
 *
 * On success the domain handler receives `actorId` merged into its input —
 * the fixed mechanism by which verified identity reaches commands (spec 4.2
 * §4). Guard failures are transport-level Responses, not DomainErrors.
 */
export const requireRole =
  (role: UserRole | "any", fn: HandlerFn): HandlerFn =>
  async (input, event) => {
    // Cookie-only since the httpOnly migration — no Authorization fallback,
    // so the old XSS-relevant surface is fully retired (migration Q&A 1).
    // Node and API Gateway v2 lowercase header names; v1 may not.
    const decoded = verifyJwt(
      readTokenFromCookie(event.headers?.cookie ?? event.headers?.Cookie)
    );
    if (!decoded) {
      return errorResponse(401, "UNAUTHORIZED", "Missing or invalid token");
    }
    if (role !== "any" && decoded.role !== role) {
      return errorResponse(403, "FORBIDDEN", "Insufficient role");
    }
    return fn({ ...input, actorId: decoded.userId }, event);
  };
