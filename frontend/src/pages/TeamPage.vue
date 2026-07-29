<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ApiError } from "../api/client";
import { listTeamVacations } from "../api/requests";
import RequestTable from "../components/RequestTable.vue";
import { formatDate, formatMonth } from "../utils/formatDate";
import type { TeamVacation } from "../types";

const vacations = ref<TeamVacation[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    vacations.value = await listTeamVacations();
  } catch (err) {
    loadError.value =
      err instanceof ApiError ? err.message : "Could not load team vacations";
  } finally {
    loading.value = false;
  }
});

/** TeamVacation has no id — the composite key exists only for Vue's :key.
 * Unique in practice: the same person can't hold two identical approved
 * ranges (Rule 2), and different people differ by name. */
type KeyedVacation = TeamVacation & { key: string };

/**
 * Month-grouping lives here, in the page (spec 4.9 §8 Q1) — the shared
 * table stays a dumb renderer. Grouped by the UTC month of startDate; a
 * cross-month span appears once, under its start month (§8 Q2, known
 * limitation 10). Insertion order is chronological because the server
 * sends startDate ASC (spec 4.6 §5) — no client re-sort.
 */
const monthGroups = computed((): { heading: string; rows: KeyedVacation[] }[] => {
  const groups = new Map<string, KeyedVacation[]>();
  for (const vacation of vacations.value) {
    const monthKey = vacation.startDate.slice(0, 7); // "2026-08"
    const rows = groups.get(monthKey) ?? [];
    rows.push({
      ...vacation,
      key: `${vacation.requesterName}|${vacation.startDate}|${vacation.endDate}`,
    });
    groups.set(monthKey, rows);
  }
  return [...groups.entries()].map(([monthKey, rows]) => ({
    heading: formatMonth(`${monthKey}-01`),
    rows,
  }));
});

const columns: { key: keyof KeyedVacation & string; label: string }[] = [
  { key: "requesterName", label: "Employee" },
  { key: "startDate", label: "Dates" },
];
</script>

<template>
  <main class="mx-auto max-w-4xl p-8">
    <h1 class="mb-2 text-xl font-semibold text-slate-800">Team Vacations</h1>
    <p class="mb-6 text-sm text-slate-500">
      Approved time off across the team, grouped by month.
    </p>

    <p v-if="loading" class="text-sm text-slate-500">Loading team vacations…</p>
    <p v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>
    <p v-else-if="monthGroups.length === 0" class="text-sm text-slate-400">
      No approved vacations yet.
    </p>

    <section v-for="group in monthGroups" :key="group.heading" class="mb-8">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ group.heading }}
      </h2>
      <RequestTable
        :rows="group.rows"
        :columns="columns"
        row-key="key"
        empty-text="No vacations this month."
      >
        <template #cell-startDate="{ row }">
          {{ formatDate(row.startDate) }} – {{ formatDate(row.endDate) }}
        </template>
      </RequestTable>
    </section>
  </main>
</template>
