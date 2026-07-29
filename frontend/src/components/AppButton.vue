<script setup lang="ts">
import { computed } from "vue";

// The one button markup (spec 4.11 §5): variant picks the color cluster,
// size the dimensions — their union reproduces the exact Tailwind sets the
// pages carried inline. No click handling here; consumers keep @click via
// attribute fallthrough (layout classes like w-full merge the same way).
// `type` defaults to "button" because every no-type consumer sits outside
// a form (spec 4.11 §9 audit) — an in-form AppButton must pass
// type="submit" explicitly or it will not submit.
type Variant = "primary" | "success" | "danger" | "secondary";
type Size = "sm" | "md";

const props = defineProps<{
  variant?: Variant;
  size?: Size;
  type?: "button" | "submit";
  disabled?: boolean;
}>();

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50",
  success: "bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50",
  danger: "bg-red-700 text-white hover:bg-red-600 disabled:opacity-50",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const classes = computed(
  (): string =>
    `rounded font-medium ${SIZE_CLASSES[props.size ?? "md"]} ${VARIANT_CLASSES[props.variant ?? "primary"]}`
);
</script>

<template>
  <button :type="type ?? 'button'" :disabled="disabled" :class="classes">
    <slot></slot>
  </button>
</template>
