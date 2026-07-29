import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { roleHome } from "./roleHome";
import type { Role } from "../types";

declare module "vue-router" {
  interface RouteMeta {
    /** Absent = public. "any" = any authenticated role (spec 4.8 §8 Q2). */
    requiresRole?: Role | "any";
  }
}

/**
 * `/` and unknown paths land via the same rule as everything else: your role
 * home when authenticated, /login otherwise (spec 4.8 §4). A redirect
 * function runs at navigation time, so the store is safe to read here.
 */
const landingRedirect = (): string => {
  const auth = useAuthStore();
  auth.syncFromToken();
  return auth.isAuthenticated && auth.role ? roleHome(auth.role) : "/login";
};

/** Paths + meta are the frozen contract 4.9/4.10 build on (spec 4.8 §5). */
const routes: RouteRecordRaw[] = [
  { path: "/login", name: "login", component: () => import("../pages/LoginPage.vue") },
  {
    path: "/my-requests",
    name: "my-requests",
    component: () => import("../pages/MyRequestsPage.vue"),
    meta: { requiresRole: "Requester" },
  },
  {
    path: "/team",
    name: "team",
    component: () => import("../pages/TeamPage.vue"),
    meta: { requiresRole: "any" },
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: () => import("../pages/DashboardPage.vue"),
    meta: { requiresRole: "Validator" },
  },
  { path: "/", redirect: landingRedirect },
  { path: "/:pathMatch(.*)*", redirect: landingRedirect },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// The guard matrix from spec 4.8 §4 — the one global role check
// (rules/frontend.md: no per-component checks). UX only; the backend's
// requireRole wrapper is the real enforcement (ADR 0003).
router.beforeEach((to) => {
  const auth = useAuthStore();
  // Fresh decode before every check: drops expired/undecodable sessions
  // proactively (spec 4.8 §4) — see syncFromToken for why the getter alone
  // can't do this.
  auth.syncFromToken();

  const required = to.meta.requiresRole;

  if (!required) {
    // Public route while logged in (e.g. /login): back to your own home.
    return auth.isAuthenticated && auth.role ? roleHome(auth.role) : true;
  }
  if (!auth.isAuthenticated || !auth.role) {
    return "/login";
  }
  if (required === "any" || required === auth.role) {
    return true;
  }
  // Authenticated but wrong role: your own home, never a 403 page (§8 Q3).
  return roleHome(auth.role);
});
