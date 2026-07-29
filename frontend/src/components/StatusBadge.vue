<script setup lang="ts">
import { computed } from "vue";
import type { VacationRequestStatus } from "../types";

// Status enum only — no request-specific props (spec 4.9 §8 Q0). This file
// is the single home of status markup (§6.1).
const props = defineProps<{ status: VacationRequestStatus }>();

const COLORS: Record<VacationRequestStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

const colorClasses = computed(() => COLORS[props.status]);
</script>

<template>
  <span
    class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="colorClasses"
  >
    {{ status }}
  </span>
</template>
