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

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8888",
  // Explicit: the JWT travels in the Authorization header, not a cookie (TDD §6).
  // Keeping this false is what makes the backend's Access-Control-Allow-Origin: *
  // legal — a credentialed request would require a specific origin instead.
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

let readToken: () => string | null = () => null;

/**
 * Supplies the JWT to the request interceptor without this module importing the
 * auth store — the store's login action calls this client, so a direct import
 * would be circular. Wired once at app startup.
 */
export const setTokenProvider = (provider: () => string | null): void => {
  readToken = provider;
};

apiClient.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: () => void = () => {};

/**
 * Session-expiry hook, wired once in main.ts (same inversion as
 * setTokenProvider — importing the store here would be circular). Fires only
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
