<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { apiErrorMessage } from "../api/client";
import { createRequest, listMyRequests } from "../api/requests";
import AppButton from "../components/AppButton.vue";
import FormField from "../components/FormField.vue";
import RequestTable from "../components/RequestTable.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { formatDate, formatDateRange } from "../utils/formatDate";
import type { VacationRequest } from "../types";

// Local list state per ADR 0005: fetched on mount, refetched after a
// successful create — Postgres stays the source of truth, no client-side
// list mutation.
const requests = ref<VacationRequest[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const load = async (): Promise<void> => {
  loading.value = true;
  loadError.value = null;
  try {
    requests.value = await listMyRequests();
  } catch (err) {
    loadError.value = apiErrorMessage(err, "Could not load your requests");
  } finally {
    loading.value = false;
  }
};
onMounted(load);

// Collapsible form (spec 4.9 §8 Q3): the list is the page's subject; the
// form appears on demand and collapses after a successful submit.
const formOpen = ref(false);
const startDate = ref("");
const endDate = ref("");
const reason = ref("");
const submitError = ref<string | null>(null);
const submitting = ref(false);

/** min for the start input — client-local "today", UX only (A5): the
 * server's UTC check is the enforcement. */
const today = new Date();
const todayIso = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

/** end's min tracks the chosen start (spec 4.9 §8 Q8). */
const endMin = computed(() => (startDate.value !== "" ? startDate.value : todayIso));

const toggleForm = (): void => {
  formOpen.value = !formOpen.value;
  submitError.value = null;
};

const submit = async (): Promise<void> => {
  submitError.value = null;
  submitting.value = true;
  try {
    // reason sent as typed — ""/whitespace → null is the server's
    // normalizeReason (spec 4.7), never the client's.
    await createRequest({
      startDate: startDate.value,
      endDate: endDate.value,
      reason: reason.value,
    });
    startDate.value = "";
    endDate.value = "";
    reason.value = "";
    formOpen.value = false;
    await load();
  } catch (err) {
    // Card stays open, values retained (spec 4.9 §4) — the envelope
    // message is the contract's wording (4.8 login pattern).
    submitError.value = apiErrorMessage(err, "Something went wrong — try again");
  } finally {
    submitting.value = false;
  }
};

const columns: { key: keyof VacationRequest & string; label: string }[] = [
  { key: "startDate", label: "Dates" },
  { key: "status", label: "Status" },
  { key: "reason", label: "Reason" },
  { key: "comments", label: "Comment" },
  { key: "createdAt", label: "Submitted" },
];
</script>

<template>
  <main class="mx-auto max-w-4xl p-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-800">My Requests</h1>
      <AppButton @click="toggleForm">
        {{ formOpen ? "Cancel" : "New request" }}
      </AppButton>
    </div>

    <form
      v-if="formOpen"
      class="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      @submit.prevent="submit"
    >
      <h2 class="mb-4 text-sm font-semibold text-slate-800">New vacation request</h2>
      <FormField
        id="start-date"
        v-model="startDate"
        label="Start date"
        type="date"
        :min="todayIso"
        required
      />
      <FormField
        id="end-date"
        v-model="endDate"
        label="End date"
        type="date"
        :min="endMin"
        required
      />
      <FormField
        id="reason"
        v-model="reason"
        label="Reason (optional)"
        type="textarea"
        :maxlength="500"
      />
      <p v-if="submitError" class="mb-4 text-sm text-red-600">{{ submitError }}</p>
      <AppButton type="submit" :disabled="submitting">
        {{ submitting ? "Submitting…" : "Submit request" }}
      </AppButton>
    </form>

    <p v-if="loading" class="text-sm text-slate-500">Loading your requests…</p>
    <p v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
    <RequestTable
      v-else
      :rows="requests"
      :columns="columns"
      row-key="id"
      empty-text="No requests yet — submit your first one above."
    >
      <template #cell-startDate="{ row }">
        {{ formatDateRange(row.startDate, row.endDate) }}
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :status="row.status" />
      </template>
      <template #cell-comments="{ row }">
        <!-- Rejection comment on rejected rows only (US-3). -->
        {{ row.status === "Rejected" ? (row.comments ?? "") : "" }}
      </template>
      <template #cell-createdAt="{ row }">
        {{ formatDate(row.createdAt) }}
      </template>
    </RequestTable>
  </main>
</template>
