import axios, { type AxiosError, type AxiosInstance } from "axios";

/** Error envelope every backend endpoint returns (TDD §7). */
interface ApiErrorBody {
  error: { code: string; message: string };
}

/**
 * Normalized failure. Every rejected request from this client throws one of
 * these, so callers never dig through `error.response.data` themselves.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * The one place a caught error becomes display text (spec 4.11 §8 Q8):
 * ApiError → its envelope message, anything else → the caller's fallback.
 */
export const apiErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback;

export const apiClient: AxiosInstance = axios.create({
  // "/api" is the Vite dev proxy prefix (vite.config.ts): requests stay
  // same-origin, so the httpOnly auth cookie attaches automatically and CORS
  // never enters — mandatory in dev, because the CEF dev server's preflight
  // hardcodes Access-Control-Allow-Origin: *, which credentialed cross-origin
  // requests forbid. No request interceptor: the browser carries the token.
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  headers: { "Content-Type": "application/json" },
});

let onUnauthorized: () => void = () => {};

/**
 * Session-expiry hook, wired once in main.ts (inversion because importing
 * the store here would be circular, lint-banned). Fires only
 * on 401 UNAUTHORIZED: INVALID_CREDENTIALS is also a 401, but it means "wrong
 * password", which the login page renders — not a dead session (spec 4.8 §4).
 */
export const setUnauthorizedHandler = (handler: () => void): void => {
  onUnauthorized = handler;
};

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const body = error.response?.data?.error;
    const apiError = new ApiError(
      error.response?.status ?? 0,
      body?.code ?? "NETWORK_ERROR",
      body?.message ?? error.message
    );
    if (apiError.status === 401 && apiError.code === "UNAUTHORIZED") {
      onUnauthorized();
    }
    return Promise.reject(apiError);
  }
);
