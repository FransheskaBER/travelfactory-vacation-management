import { defineStore } from "pinia";
import { jwtDecode } from "jwt-decode";
import { login as apiLogin } from "../api/auth";
import type { Role } from "../types";

/**
 * Structural mirror of the backend's JwtPayload (spec 4.2 §5) plus the `exp`
 * claim jsonwebtoken adds — duplicated by design, no shared package exists
 * between the two workspaces (spec 4.8 §4).
 */
interface JwtPayload {
  userId: string;
  role: Role;
  exp: number;
}

interface AuthState {
  token: string | null;
  role: Role | null;
  userId: string | null;
}

/**
 * Decodes and validates in one step: null for an absent, undecodable, or
 * expired token — the three cases spec 4.8 §4 treats identically. `exp` is
 * never stored; it is read off the token on every call, so the token stays
 * the single source of truth.
 */
const readValidPayload = (token: string | null): JwtPayload | null => {
  if (!token) return null;
  try {
    const payload = jwtDecode<JwtPayload>(token);
    return payload.exp * 1000 > Date.now() ? payload : null;
  } catch {
    return null;
  }
};

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({ token: null, role: null, userId: null }),
  getters: {
    isAuthenticated: (state): boolean => readValidPayload(state.token) !== null,
  },
  actions: {
    /** Throws ApiError (wrong credentials, network) — the login page renders it. */
    async login(email: string, password: string): Promise<void> {
      const token = await apiLogin(email, password);
      const payload = readValidPayload(token);
      if (!payload) {
        throw new Error("Received an unreadable token — backend and frontend disagree on the JWT format");
      }
      this.token = token;
      this.role = payload.role;
      this.userId = payload.userId;
    },

    logout(): void {
      this.token = null;
      this.role = null;
      this.userId = null;
    },

    /**
     * Guard hook, run before every navigation: clears state when the persisted
     * token no longer yields a valid payload (expiry and decode failure — spec
     * 4.8 §4), and re-derives role/userId from it when it does. The fresh
     * decode here, not the cached getter, is what makes the proactive check
     * true per-navigation: a computed only re-evaluates when the token
     * *changes*, and expiry is a change in time, not in state.
     */
    syncFromToken(): void {
      const payload = readValidPayload(this.token);
      if (payload) {
        this.role = payload.role;
        this.userId = payload.userId;
      } else if (this.token) {
        this.logout();
      }
    },
  },
  persist: true,
});
