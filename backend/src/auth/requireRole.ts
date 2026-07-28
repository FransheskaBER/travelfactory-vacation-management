import { HandlerFn } from "../handlers/types";
import { errorResponse } from "../errors/toErrorResponse";
import { UserRole } from "../entities/User";
import { verifyJwt } from "./jwt";

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
    // Node and API Gateway v2 lowercase header names; v1 may not.
    const decoded = verifyJwt(
      event.headers?.authorization ?? event.headers?.Authorization
    );
    if (!decoded) {
      return errorResponse(401, "UNAUTHORIZED", "Missing or invalid token");
    }
    if (role !== "any" && decoded.role !== role) {
      return errorResponse(403, "FORBIDDEN", "Insufficient role");
    }
    return fn({ ...input, actorId: decoded.userId }, event);
  };
