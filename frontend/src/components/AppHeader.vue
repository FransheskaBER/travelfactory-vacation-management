<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

// Role-aware nav (spec 4.9 §8 Q4): links per role, one header for both
// interfaces — 4.10 inherits this finished. UX only; the guard + backend
// requireRole remain the enforcement (ADR 0003).
const navLinks = computed((): { to: string; label: string }[] => {
  if (auth.role === "Requester") {
    return [
      { to: "/my-requests", label: "My Requests" },
      { to: "/team", label: "Team" },
    ];
  }
  if (auth.role === "Validator") {
    return [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/team", label: "Team" },
    ];
  }
  return [];
});

const logout = async (): Promise<void> => {
  // Resolves even if the network call fails — the store clears local state
  // regardless, so this device always lands logged-out on /login.
  await auth.logout();
  await router.push("/login");
};
</script>

<template>
  <header
    class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3"
  >
    <div class="flex items-center gap-6">
      <span class="text-sm font-semibold text-slate-800">TravelFactory Vacations</span>
      <nav class="flex gap-4">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="text-sm text-slate-500 hover:text-slate-800"
          active-class="font-medium text-slate-900"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
    </div>
    <button
      class="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
      @click="logout"
    >
      Log out
    </button>
  </header>
</template>
