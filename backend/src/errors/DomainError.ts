/**
 * Errors the domain layer throws. Deliberately free of HTTP knowledge — the
 * subclass names the *kind* of failure, and `toErrorResponse` owns the status
 * code that represents it (ADR 0001: transport concerns stay at the boundary).
 *
 * `code` is the machine-readable identifier returned to the client and is
 * specific to the rule that failed, e.g. "OVERLAPPING_REQUEST", not "CONFLICT".
 */
export abstract class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** The request is valid but the current state forbids it. */
export class ConflictError extends DomainError {}

/** The input is malformed or breaks a business rule about its own values. */
export class ValidationError extends DomainError {}

/** The referenced resource does not exist. */
export class NotFoundError extends DomainError {}
