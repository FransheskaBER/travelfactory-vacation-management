<!-- Constraint is `object`, not §5's `Record<string, unknown>`: TS
     interfaces have no implicit index signature, so the Record constraint
     rejects the exact row types §5 defines (deviation recorded, spec §9). -->
<script setup lang="ts" generic="Row extends object">
// Dumb renderer (spec 4.9 §4): rows + column config, no data knowledge.
// Consumers override any cell via the named scoped slot `#cell-<key>`
// (slots, not render callbacks — rules/frontend.md); the default cell
// renders the row value as text. Which columns exist is the consumer's
// call — the team view's `reason` exclusion is config, not a fork (A14).
interface Column {
  key: keyof Row & string;
  label: string;
}

defineProps<{
  rows: Row[];
  columns: Column[];
  rowKey: keyof Row & string;
  emptyText: string;
}>();

// Types the `row` prop of every #cell-<key> scoped slot for consumers —
// without this, slot props fall back to loose inference in templates.
defineSlots<Record<string, (props: { row: Row }) => unknown>>();

const cellText = (row: Row, key: keyof Row & string): string => {
  const value = row[key];
  return value == null ? "" : String(value);
};
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <th v-for="col in columns" :key="col.key" class="px-4 py-3 font-medium">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="String(row[rowKey])"
          class="border-t border-slate-100"
        >
          <td v-for="col in columns" :key="col.key" class="px-4 py-3 align-top text-slate-700">
            <slot :name="`cell-${col.key}`" :row="row">{{ cellText(row, col.key) }}</slot>
          </td>
        </tr>
        <tr v-if="rows.length === 0" class="border-t border-slate-100">
          <td :colspan="columns.length" class="px-4 py-6 text-center text-slate-400">
            {{ emptyText }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
