import { Response } from "commoneventframework";
import {
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from "./DomainError";

/** Shared error envelope for every endpoint (TDD §7). */
const errorResponse = (status: number, code: string, message: string): Response =>
  new Response(status, { error: { code, message } });

const statusFor = (err: DomainError): number => {
  if (err instanceof ConflictError) return 409;
  if (err instanceof ValidationError) return 400;
  if (err instanceof NotFoundError) return 404;
  return 500;
};

/**
 * Single translation point from thrown error to HTTP response.
 *
 * Anything that isn't a DomainError is unexpected, so it is logged and reported
 * as a fixed 500 — its message is never returned, since it may carry connection
 * strings, SQL fragments, or other internals.
 */
export const toErrorResponse = (err: unknown): Response => {
  if (err instanceof DomainError) {
    return errorResponse(statusFor(err), err.code, err.message);
  }

  console.error("[unmapped error]", err);
  return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
};
