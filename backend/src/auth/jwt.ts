import * as jwt from "jsonwebtoken";
import { getEnvValue } from "commoneventframework/dist/utils/getEnvValue";
import { UserRole } from "../entities/User";

// Claim names follow ADR 0003's sample (`decoded.userId`, `decoded.role`).
export interface JwtPayload {
  userId: string;
  role: UserRole;
}

// Single access token, no refresh — D12. 24h so a token survives a full
// review/demo session (spec 4.2 §8 Q5).
const EXPIRY = "24h";

// Read at call time, never at module load — env vars exist only after CEF's
// envReady has resolved the alias prefixes (same lazy rule as dataSource.ts).
// getEnvValue throws a named error when JWT_SECRET is unset, so a missing
// secret can never silently sign tokens with an empty string. Its declared
// return type is `string | undefined`, but without a fallback argument the
// undefined arm is unreachable (it throws instead) — the guard below only
// narrows the type.
const secret = (): string => {
  const value = getEnvValue("JWT_SECRET");
  if (!value) throw new Error('env param "JWT_SECRET" is mandatory');
  return value;
};

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" &&
  (Object.values(UserRole) as string[]).includes(value);

const isJwtPayload = (value: unknown): value is JwtPayload => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.userId === "string" && isUserRole(record.role);
};

export const signJwt = (payload: JwtPayload): string =>
  jwt.sign({ userId: payload.userId, role: payload.role }, secret(), {
    expiresIn: EXPIRY,
  });

/**
 * Verifies the raw `authorization` header value (`Bearer <token>`).
 * Returns the decoded payload, or null for every failure — missing header,
 * wrong scheme, bad signature, expiry, or a payload that doesn't match
 * JwtPayload. One failure class by design (spec 4.2 §8 Q6); the caller
 * (requireRole) owns the HTTP response.
 */
export const verifyJwt = (authHeader: string | undefined): JwtPayload | null => {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded: unknown = jwt.verify(token, secret());
    if (!isJwtPayload(decoded)) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
};
