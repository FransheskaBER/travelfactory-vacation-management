<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ApiError, apiErrorMessage } from "../api/client";
import { approveRequest, listDashboard, rejectRequest } from "../api/requests";
import { listUsers } from "../api/users";
import AppButton from "../components/AppButton.vue";
import FormField from "../components/FormField.vue";
import PaginationControls from "../components/PaginationControls.vue";
import RequestTable from "../components/RequestTable.vue";
import StatusBadge from "../components/StatusBadge.vue";
import { formatDate, formatDateRange } from "../utils/formatDate";
import type {
  DashboardResult,
  UserSummary,
  VacationRequest,
  VacationRequestStatus,
} from "../types";

// Page-local state per ADR 0005: fetched on mount, refetched after every
// state change — Postgres stays the source of truth (spec 4.10 §4).
const users = ref<UserSummary[]>([]);
const result = ref<DashboardResult | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

const page = ref(1);
const statusFilter = ref(""); // "" = All → param omitted
const userFilter = ref(""); // "" = no user filter (combobox un-filter, §8 Q6)

const isVacationRequestStatus = (
  value: string
): value is VacationRequestStatus =>
  value === "Pending" || value === "Approved" || value === "Rejected";

/** Every refetch flows through here, so clamp-back is a property of all of
 * them (spec 4.10 §4): an empty page > 1 steps back and refetches —
 * terminates because page strictly decreases toward 1. */
const fetchPage = async (): Promise<void> => {
  const data = await listDashboard({
    page: page.value,
    status: isVacationRequestStatus(statusFilter.value)
      ? statusFilter.value
      : undefined,
    userId: userFilter.value === "" ? undefined : userFilter.value,
  });
  if (data.data.length === 0 && data.page > 1) {
    page.value = data.page - 1;
    await fetchPage();
    return;
  }
  result.value = data;
};

onMounted(async () => {
  // Users + first page in parallel; either failing renders the full-region
  // load-error state — mount-only treatment (spec 4.10 §4).
  try {
    const [userList] = await Promise.all([listUsers(), fetchPage()]);
    users.value = userList;
  } catch (err) {
    loadError.value = apiErrorMessage(err, "Could not load the dashboard");
  } finally {
    loading.value = false;
  }
});

// Client-side name resolution (spec 4.6 §8 Q10): one fetched list resolves
// userId and reviewedBy. Absent uuid → the uuid itself (§8 Q8, unreachable
// in practice); null (Pending's reviewedBy) → blank.
const nameById = computed(() => new Map(users.value.map((u) => [u.id, u.name])));
const resolveName = (id: string | null): string =>
  id === null ? "" : (nameById.value.get(id) ?? id);

const userOptions = computed(() =>
  users.value.map((u) => ({ value: u.id, label: u.name }))
);

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

// Post-mount refetch: failures land in the page-level line with the
// last-good table retained — never the full-region state (spec 4.10 §4).
const actionError = ref<string | null>(null);

const refetch = async (): Promise<void> => {
  actionError.value = null;
  try {
    await fetchPage();
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Could not refresh the list");
  }
};

// Inline reject form (§8 Q1): one row open at a time — a single id ref is
// that invariant. Static field id "reject-comment" per §5.
const rejectingId = ref<string | null>(null);
const rejectComment = ref("");
const rejectError = ref<string | null>(null);
const actionPending = ref(false);

const openReject = (row: VacationRequest): void => {
  rejectingId.value = row.id;
  rejectComment.value = "";
  rejectError.value = null;
};

const closeReject = (): void => {
  rejectingId.value = null;
  rejectComment.value = "";
  rejectError.value = null;
};

// Any filter change → page 1, refetch (§8 Q4); typing in the combobox never
// lands here because it emits nothing (§8 Q5/Q6 — the FormField contract).
watch([statusFilter, userFilter], () => {
  closeReject();
  page.value = 1;
  void refetch();
});

const onPageChange = (target: number): void => {
  closeReject();
  page.value = target;
  void refetch();
};

/** Shared 409 handling (spec 4.10 §4): the row was processed elsewhere —
 * refetch so the table shows displayed truth, keeping the error message. */
const refetchAfterConflict = async (): Promise<void> => {
  try {
    await fetchPage();
  } catch {
    // Keep the 409 message — a failed truth-refresh has nothing better to say.
  }
};

const approve = async (row: VacationRequest): Promise<void> => {
  closeReject();
  actionError.value = null;
  actionPending.value = true;
  try {
    await approveRequest(row.id);
    await fetchPage();
  } catch (err) {
    actionError.value = apiErrorMessage(err, "Something went wrong — try again");
    if (err instanceof ApiError && err.status === 409) {
      await refetchAfterConflict();
    }
  } finally {
    actionPending.value = false;
  }
};

const submitReject = async (): Promise<void> => {
  if (rejectingId.value === null) {
    return;
  }
  rejectError.value = null;
  actionPending.value = true;
  try {
    // Comment sent as typed — trimming and Rule 5 are the server's (§4).
    await rejectRequest(rejectingId.value, rejectComment.value);
  } catch (err) {
    // Form stays open, value retained, message inside the detail row (§4).
    rejectError.value = apiErrorMessage(err, "Something went wrong — try again");
    if (err instanceof ApiError && err.status === 409) {
      await refetchAfterConflict();
    }
    actionPending.value = false;
    return;
  }
  actionPending.value = false;
  closeReject();
  await refetch();
};

// Columns per §4 (US-5 + §8 Q9 + actions). The actions column rides the
// `id` key — Column.key must be a real row key, and the slot override
// replaces the default cell, so the uuid never renders (§9).
const columns: { key: keyof VacationRequest & string; label: string }[] = [
  { key: "userId", label: "Requester" },
  { key: "startDate", label: "Dates" },
  { key: "reason", label: "Reason" },
  { key: "status", label: "Status" },
  { key: "reviewedBy", label: "Reviewed by" },
  { key: "createdAt", label: "Submitted" },
  { key: "id", label: "Actions" },
];
</script>

<template>
  <main class="mx-auto max-w-6xl p-8">
    <h1 class="mb-6 text-xl font-semibold text-slate-800">Validator Dashboard</h1>

    <p v-if="loading" class="text-sm text-slate-500">Loading the dashboard…</p>
    <p v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
    <template v-else-if="result">
      <div class="mb-4 grid max-w-xl grid-cols-2 gap-4">
        <FormField
          id="status-filter"
          v-model="statusFilter"
          label="Status"
          type="select"
          :options="statusOptions"
        />
        <FormField
          id="user-filter"
          v-model="userFilter"
          label="Requester"
          type="combobox"
          :options="userOptions"
        />
      </div>

      <p v-if="actionError" class="mb-4 text-sm text-red-600">{{ actionError }}</p>

      <RequestTable
        :rows="result.data"
        :columns="columns"
        row-key="id"
        empty-text="No requests match the current filters."
        :expanded-key="rejectingId"
      >
        <template #cell-userId="{ row }">
          {{ resolveName(row.userId) }}
        </template>
        <template #cell-startDate="{ row }">
          {{ formatDateRange(row.startDate, row.endDate) }}
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :status="row.status" />
        </template>
        <template #cell-reviewedBy="{ row }">
          {{ resolveName(row.reviewedBy) }}
        </template>
        <template #cell-createdAt="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
        <template #cell-id="{ row }">
          <!-- Actions ride the id key; Pending only — terminal rows render an
               empty cell (§8 Q7). The v-else span is load-bearing: a slot
               whose render is comment-nodes-only makes Vue fall back to the
               default cell, which would print the uuid (§6.3). -->
          <div v-if="row.status === 'Pending'" class="flex gap-2">
            <AppButton
              variant="success"
              size="sm"
              :disabled="actionPending"
              @click="approve(row)"
            >
              Approve
            </AppButton>
            <AppButton
              variant="danger"
              size="sm"
              :disabled="actionPending"
              @click="openReject(row)"
            >
              Reject
            </AppButton>
          </div>
          <span v-else></span>
        </template>
        <template #row-detail>
          <form class="max-w-xl" @submit.prevent="submitReject">
            <FormField
              id="reject-comment"
              v-model="rejectComment"
              label="Rejection comment"
              type="textarea"
              :maxlength="500"
              required
            />
            <p v-if="rejectError" class="mb-4 text-sm text-red-600">{{ rejectError }}</p>
            <div class="flex gap-2">
              <AppButton type="submit" variant="danger" :disabled="actionPending">
                Confirm rejection
              </AppButton>
              <AppButton variant="secondary" @click="closeReject">
                Cancel
              </AppButton>
            </div>
          </form>
        </template>
      </RequestTable>

      <PaginationControls
        :page="result.page"
        :total="result.total"
        :limit="result.limit"
        @update:page="onPageChange"
      />
    </template>
  </main>
</template>
