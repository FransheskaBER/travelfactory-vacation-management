<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ApiError } from "../api/client";
import { roleHome } from "../router/roleHome";

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const errorMessage = ref<string | null>(null);
const pending = ref(false);

// No client-side email validation: the backend's 400/401 messages are the
// contract's wording (spec 4.8 §4).
const submit = async (): Promise<void> => {
  errorMessage.value = null;
  pending.value = true;
  try {
    await auth.login(email.value, password.value);
    await router.push(auth.role ? roleHome(auth.role) : "/login");
  } catch (err) {
    errorMessage.value =
      err instanceof ApiError ? err.message : "Something went wrong — try again";
  } finally {
    pending.value = false;
  }
};
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <form
      class="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
      @submit.prevent="submit"
    >
      <h1 class="mb-6 text-xl font-semibold text-slate-800">
        TravelFactory Vacations
      </h1>

      <label class="mb-1 block text-sm font-medium text-slate-700" for="email">
        Email
      </label>
      <input
        id="email"
        v-model="email"
        type="email"
        autocomplete="username"
        required
        class="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <label class="mb-1 block text-sm font-medium text-slate-700" for="password">
        Password
      </label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        class="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <p v-if="errorMessage" class="mb-4 text-sm text-red-600">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        :disabled="pending"
        class="w-full rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {{ pending ? "Signing in…" : "Sign in" }}
      </button>
    </form>
  </main>
</template>
