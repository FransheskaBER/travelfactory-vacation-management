---
paths:
  - "frontend/**"
---

# Frontend conventions (Vue 3 + TS)

## Vue
- Every component: `<script setup lang="ts">` — enforced by lint
  (vue/component-api-style); missing v-for :key is caught by the vue
  essential preset. Pointers, not rules.
- Props typed via defineProps<{...}>(); events via defineEmits — never
  pass callback functions as props (that's React bleeding through)
- Templates: class not className; {{ }} not { }
- All date display goes through the shared formatDate util in
  src/utils/ (created by the first chunk that renders a date, along
  with a lint ban on inline toLocaleDateString). Never format dates
  ad hoc in components.

## State & auth
- Pinia auth store (src/stores/auth.ts) is the single source of truth
  for token, user, role. Components and router guards read the store.
  (localStorage outside src/stores/ is banned by lint — pointer.)
- The store supplies the token to the API layer via
  setTokenProvider(() => ...) wired once in main.ts. (client.ts
  importing a store — a circular dependency — is banned by lint,
  scoped to that file — pointer.)
- Route guards: routes declare meta: { requiresRole: "Validator" };
  one global beforeEach enforces it. No per-component role checks.

## API layer
- src/api/client.ts already exists — extend it, don't rewrite it. One
  axios instance: baseURL from VITE_API_BASE_URL, request interceptor
  attaches the token, response interceptor maps { error: { code,
  message } } into the typed ApiError class
- Components call functions from src/api/*.ts. (Direct axios imports
  and fetch outside src/api/ are banned by lint — pointer.)
- Callers catch ApiError (status, code, message) — never dig through
  AxiosError or error.response.data; the interceptor already did.

## Reusable components (assignment requirement — treat as hard)
- Shared UI lives in src/components/: StatusBadge, RequestTable,
  PaginationControls, FormField
- If markup for statuses, tables, pagination, or form fields appears
  in a page component, extract it — duplicated markup between the two
  interfaces is a rejected diff
- Tailwind: utility classes in templates; repeated class clusters are
  a signal to extract a component, not to write @apply soup
