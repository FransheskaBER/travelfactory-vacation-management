<script setup lang="ts">
import { computed, ref } from "vue";

// Label + v-model + #error slot + attribute passthrough (spec 4.9 §5, §8 Q0).
// Extended via props for 4.10's filter bar (spec 4.10 §5, §8 Q3/Q5):
// "select" renders `options` as a native select; "combobox" is a custom
// type-ahead dropdown over the same `options` — the extension mechanism the
// checklist sanctions, never a fork. The consumer owns error message markup
// via the slot.
interface Option {
  value: string;
  label: string;
}

const props = defineProps<{
  id: string;
  label: string;
  modelValue: string;
  type?: "text" | "date" | "textarea" | "select" | "combobox";
  options?: Option[];
  maxlength?: number;
  min?: string;
  required?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const onInput = (event: Event): void => {
  emit(
    "update:modelValue",
    (event.target as HTMLInputElement | HTMLTextAreaElement).value
  );
};

const onSelectChange = (event: Event): void => {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
};

// Combobox internals (spec 4.10 §5, §8 Q5): the input shows display text;
// modelValue carries the selected option VALUE. Typing filters the list but
// emits nothing — only selecting emits the value, and clearing emits ""
// (the consumer's un-filter path, §8 Q6). Blur covers click-outside; option
// buttons select on mousedown.prevent so the click lands before blur closes
// the list. No keyboard option-navigation / ARIA listbox (§8 Q5's scope cut).
const comboText = ref("");
const comboOpen = ref(false);

const filteredOptions = computed<Option[]>(() => {
  const query = comboText.value.toLowerCase();
  return (props.options ?? []).filter((option) =>
    option.label.toLowerCase().includes(query)
  );
});

const onComboInput = (event: Event): void => {
  comboText.value = (event.target as HTMLInputElement).value;
  comboOpen.value = true;
  if (comboText.value === "") {
    emit("update:modelValue", "");
  }
};

const selectOption = (option: Option): void => {
  comboText.value = option.label;
  comboOpen.value = false;
  emit("update:modelValue", option.value);
};
</script>

<template>
  <div class="mb-4">
    <label class="mb-1 block text-sm font-medium text-slate-700" :for="id">
      {{ label }}
    </label>
    <textarea
      v-if="type === 'textarea'"
      :id="id"
      :value="modelValue"
      :maxlength="maxlength"
      :required="required"
      rows="3"
      class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      @input="onInput"
    ></textarea>
    <select
      v-else-if="type === 'select'"
      :id="id"
      :value="modelValue"
      :required="required"
      class="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      @change="onSelectChange"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <div v-else-if="type === 'combobox'" class="relative">
      <input
        :id="id"
        :value="comboText"
        type="text"
        autocomplete="off"
        :required="required"
        class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        @input="onComboInput"
        @focus="comboOpen = true"
        @blur="comboOpen = false"
        @keydown.esc="comboOpen = false"
      />
      <ul
        v-if="comboOpen && filteredOptions.length > 0"
        class="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-slate-300 bg-white shadow-sm"
      >
        <li v-for="option in filteredOptions" :key="option.value">
          <button
            type="button"
            class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
            @mousedown.prevent="selectOption(option)"
          >
            {{ option.label }}
          </button>
        </li>
      </ul>
    </div>
    <input
      v-else
      :id="id"
      :value="modelValue"
      :type="type ?? 'text'"
      :maxlength="maxlength"
      :min="min"
      :required="required"
      class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      @input="onInput"
    />
    <slot name="error"></slot>
  </div>
</template>
