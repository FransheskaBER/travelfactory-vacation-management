# ADR 0005: State Management — Pinia for Auth, Local State for Request Lists

**Status:** Accepted

## Context

The Vue 3 frontend has two categories of data with very different sharing needs. Auth state (JWT, decoded role) is genuinely cross-cutting: Vue Router's guards need to read the role to allow/deny a route, the Axios interceptor needs the token attached to every outgoing request, and multiple unrelated components need to know "am I a Requester or a Validator." `VacationRequest` list data (my-requests, the validator dashboard, the team calendar) is the opposite: each screen fetches its own filtered slice of the same entity, and no two unrelated components ever need the same fetched array at the same time.

## Decision

Apply different state strategies to each category, rather than one blanket pattern for all app data.

- **Auth state → Pinia store.** Token and decoded role live in `useAuthStore`, matching the project's own scaffold choice (Pinia was already committed to in Phase 3, alongside Vue Router and Axios).
- **`VacationRequest` list data → local component state.** Each screen fetches its own array with `ref`/`reactive` inside `<script setup>`, on mount. Never promoted to the global store.

```ts
// stores/auth.ts — the one piece of genuinely shared state
export const useAuthStore = defineStore('auth', {
  state: () => ({ token: null as string | null, role: null as Role | null }),
  actions: {
    setAuth(token: string) {
      this.token = token;
      this.role = jwtDecode(token).role;
    },
    logout() { this.token = null; this.role = null; },
  },
  persist: true, // survives page refresh via Pinia's official plugin
});
```

```vue
<!-- MyRequests.vue — local, owned by this component only -->
<script setup lang="ts">
const requests = ref<VacationRequest[]>([]);
onMounted(async () => {
  requests.value = (await axios.get('/requests/mine')).data;
});
</script>
```

## Consequences

**Benefits:**
- Single source of truth for auth — router guards, the Axios interceptor, and any component all read the same reactive object; no risk of one part of the app seeing a stale role while another sees the current one.
- Persistence across page refresh is one config line via Pinia's official plugin, instead of hand-rolling a `localStorage` sync.
- Vue DevTools can inspect and time-travel through auth state — genuinely useful when debugging a role-check failure live.
- Keeping list data local sidesteps cache-invalidation entirely: there's no need to reason about whether a Validator's approve action should propagate into a Requester's already-open "my requests" view. Postgres stays the actual source of truth; each screen just refetches on its own mount.
- Consistent, extensible pattern: any future genuinely global concern (notifications, feature flags) follows the same Pinia-store shape already established for auth, rather than inventing a new approach each time.

**Trade-offs:**
- Introduces a dependency and a store-module pattern for exactly one piece of shared state today. If auth were the only thing this app ever needed to share, a plain module-scoped composable would do the identical job with less machinery.
- Local list data has a real, known migration cost if requirements change: if a future feature needs the same request data visible in two unrelated places at once (e.g. a pending-count badge in the nav bar, fed by the same data the dashboard shows), that specific slice has to be deliberately promoted to shared state later. Not free, but isolated and predictable when it happens.

## Alternatives Considered

- **Plain module-scoped composable for auth, instead of Pinia** — rejected. The project had already committed to Pinia at scaffold time, and Pinia's persistence plugin plus DevTools integration are close to free wins over hand-rolling the same pattern manually.
- **Promoting `VacationRequest` list data into a global store by default** — rejected. No current requirement needs the same fetched list visible in two unrelated components simultaneously. Centralizing it now would mean solving cache invalidation for a problem that doesn't exist yet — the same over-abstraction trap named in ADR 0001, one layer up the stack.

## Related ADRs

- Mirrors the same "centralize only when multiple consumers genuinely need it" principle ADR 0001 applies to backend persistence access (`findOverlapping` wrapped, trivial lookups not).
