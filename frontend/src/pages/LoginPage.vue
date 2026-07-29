<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { apiErrorMessage } from "../api/client";
import AppButton from "../components/AppButton.vue";
import FormField from "../components/FormField.vue";
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
    errorMessage.value = apiErrorMessage(err, "Something went wrong — try again");
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

      <FormField
        id="email"
        v-model="email"
        label="Email"
        type="email"
        autocomplete="username"
        required
      />
      <FormField
        id="password"
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        required
      />

      <p v-if="errorMessage" class="mb-4 text-sm text-red-600">
        {{ errorMessage }}
      </p>

      <AppButton type="submit" :disabled="pending" class="w-full">
        {{ pending ? "Signing in…" : "Sign in" }}
      </AppButton>
    </form>
  </main>
</template>
