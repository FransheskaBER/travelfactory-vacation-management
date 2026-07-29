import { apiClient } from "./client";
import type { Role } from "../types";

/**
 * POST /login success body since the httpOnly-cookie migration: the token
 * rides the Set-Cookie header and never appears here, so the server hands
 * over the session facts the client used to decode for itself.
 */
export interface SessionInfo {
  role: Role;
  userId: string;
  /** Epoch ms — feeds the store's proactive expiry check. */
  expiresAt: number;
}

/** POST /login. The browser stores the httpOnly cookie as a side effect;
 * resolves to the session facts. Throws ApiError on failure. */
export const login = async (email: string, password: string): Promise<SessionInfo> => {
  const response = await apiClient.post<SessionInfo>("/login", { email, password });
  return response.data;
};

/** POST /logout — deletes the httpOnly cookie server-side (JS can't).
 * Idempotent by contract: always 200, valid session or not. */
export const logout = async (): Promise<void> => {
  await apiClient.post("/logout");
};
