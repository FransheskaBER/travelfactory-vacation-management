<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

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
    <span class="text-sm font-semibold text-slate-800">TravelFactory Vacations</span>
    <button
      class="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100"
      @click="logout"
    >
      Log out
    </button>
  </header>
</template>
