import { getEnvValue } from "commoneventframework/dist/utils/getEnvValue";
import { TOKEN_TTL_SECONDS } from "./jwt";

// Single well-known cookie carrying the JWT (httpOnly migration brief §3).
const COOKIE_NAME = "token";

// `Secure` is env-gated, not hardcoded: local dev serves plain http, where a
// Secure cookie would silently never be stored. COOKIE_SECURE=true belongs in
// any deployed (https) environment — documented in .env.example.
const secureSuffix = (): string =>
  getEnvValue("COOKIE_SECURE", "false") === "true" ? "; Secure" : "";

/**
 * `Set-Cookie` value for a successful login. HttpOnly closes the XSS
 * token-theft channel (known-limitations 5); SameSite=Lax withholds the
 * cookie on cross-site POSTs — the CSRF stance, since every mutating
 * endpoint here is a POST.
 */
export const buildAuthCookie = (token: string): string =>
  `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TOKEN_TTL_SECONDS}${secureSuffix()}`;

/** `Set-Cookie` value that deletes the auth cookie (POST /logout). */
export const buildClearCookie = (): string =>
  `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureSuffix()}`;

/**
 * Extracts the raw JWT from a `Cookie` request header, or null when absent.
 * Parsed by hand: CEF's dev-server mapper parses cookies but drops the result
 * before the event reaches handlers (verified in dist/dev/
 * mapIncomingMessageToEvent.js), so the header is the only surface we get.
 */
export const readTokenFromCookie = (cookieHeader: string | undefined): string | null => {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === COOKIE_NAME) {
      const value = pair.slice(separator + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
};
