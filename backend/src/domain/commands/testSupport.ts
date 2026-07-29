import { expect } from "vitest";
import { DomainError } from "../../errors/DomainError";

/**
 * 'YYYY-MM-DD' for today+`days` in UTC — Rule 4's clock ("server date (UTC)",
 * PRD §5.4), so tests stay green on any calendar day.
 */
export const isoDaysFromToday = (days: number): string => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)
  )
    .toISOString()
    .slice(0, 10);
};

/**
 * Asserts `promise` rejects with the given DomainError subclass carrying the
 * given code, and returns the error. Fails if the promise resolves.
 */
export const expectDomainError = async (
  promise: Promise<unknown>,
  errorClass: abstract new (...args: never[]) => DomainError,
  code: string
): Promise<DomainError> => {
  const outcome = await promise.then(
    (resolved) => ({ resolved }),
    (thrown: unknown) => ({ thrown })
  );
  if ("resolved" in outcome) {
    throw new Error(
      `expected rejection with ${errorClass.name} ${code}, but the promise resolved`
    );
  }
  expect(outcome.thrown).toBeInstanceOf(errorClass);
  const error = outcome.thrown as DomainError;
  expect(error.code).toBe(code);
  return error;
};
