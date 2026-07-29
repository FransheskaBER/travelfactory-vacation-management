<script setup lang="ts">
import { computed } from "vue";

// Prev/Next + "Page X of Y" (spec 4.10 §8 Q2). All three props come from
// the server's response envelope — page math never hardcodes the server's
// default limit (spec 4.10 §4).
const props = defineProps<{
  page: number;
  total: number;
  limit: number;
}>();

const emit = defineEmits<{ "update:page": [page: number] }>();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / props.limit))
);

const goTo = (target: number): void => {
  // Emits only in-range pages (spec 4.10 §5) — the disabled attributes
  // already prevent this, but the guard keeps the contract independent
  // of markup.
  if (target >= 1 && target <= totalPages.value) {
    emit("update:page", target);
  }
};
</script>

<template>
  <nav class="mt-4 flex items-center justify-between text-sm">
    <button
      class="rounded border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      :disabled="page <= 1"
      @click="goTo(page - 1)"
    >
      Previous
    </button>
    <span class="text-slate-500">Page {{ page }} of {{ totalPages }}</span>
    <button
      class="rounded border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      :disabled="page >= totalPages"
      @click="goTo(page + 1)"
    >
      Next
    </button>
  </nav>
</template>
