<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
</script>

<template>
  <AppHeader v-if="auth.isAuthenticated" />
  <RouterView />
</template>
