<script setup lang="ts">
// Label + v-model + #error slot + attribute passthrough (spec 4.9 §5, §8 Q0).
// The consumer owns error message markup via the slot.
defineProps<{
  id: string;
  label: string;
  modelValue: string;
  type?: "text" | "date" | "textarea";
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
