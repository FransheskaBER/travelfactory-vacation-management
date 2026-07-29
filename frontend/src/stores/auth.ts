import { defineStore } from "pinia";
import { login as apiLogin, logout as apiLogout, type SessionInfo } from "../api/auth";
import type { Role } from "../types";

/**
 * Since the httpOnly-cookie migration the token never reaches JS: the browser
 * holds it, and the store holds only the server-supplied session facts from
 * the login body. Tampering with these persisted values yields UI drift only
 * — the backend's requireRole is the enforcement (same boundary 4.8 §2 drew).
 */
interface AuthState {
  role: Role | null;
  userId: string | null;
  /** Epoch ms, server-supplied. Replaces 4.8's decode-per-check design: an
   * httpOnly token can't be decoded, so expiry must live in state. */
  expiresAt: number | null;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({ role: null, userId: null, expiresAt: null }),
  getters: {
    isAuthenticated: (state): boolean =>
      state.role !== null &&
      state.expiresAt !== null &&
      state.expiresAt > Date.now(),
  },
  actions: {
    /** Throws ApiError (wrong credentials, network) — the login page renders it. */
    async login(email: string, password: string): Promise<void> {
      const session: SessionInfo = await apiLogin(email, password);
      this.role = session.role;
      this.userId = session.userId;
      this.expiresAt = session.expiresAt;
    },

    /** Local-only reset — the reactive 401 path and expiry sync use this
     * directly: the server already considers the session dead, so there is
     * nothing to tell it. */
    clearSession(): void {
      this.role = null;
      this.userId = null;
      this.expiresAt = null;
    },

    /**
     * Deliberate logout: ask the backend to delete the httpOnly cookie (JS
     * can't), then clear locally regardless of the outcome — an offline
     * logout must still log you out on this device (migration Q&A; the
     * cookie then dies on its own at Max-Age).
     */
    async logout(): Promise<void> {
      try {
        await apiLogout();
      } catch {
        // Swallowed by decision: local logout must not depend on the network.
      }
      this.clearSession();
    },

    /**
     * Guard hook, run before every navigation — the proactive half of expiry
     * handling (4.8 §4's two-halves design, now fed by expiresAt instead of a
     * decoded exp). The explicit clock check here, not the getter, is what
     * catches expiry: a cached getter only re-evaluates when state changes,
     * and expiry is a change in time, not in state.
     */
    syncSession(): void {
      if (this.expiresAt !== null && this.expiresAt <= Date.now()) {
        this.clearSession();
      }
    },
  },
  persist: {
    // pick: the 4.8 build persisted the raw token; these three keys are the
    // whole persisted surface now, so a stale token can never be re-written.
    pick: ["role", "userId", "expiresAt"],
    // afterHydrate: rewrite storage immediately so the stale token key from a
    // 4.8-era localStorage is purged at startup, not at the next state change
    // (acceptance criterion: localStorage contains no token anywhere).
    afterHydrate: (context) => {
      context.store.$persist();
    },
  },
});
