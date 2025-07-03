<template>
  <svg :width="width" :height="height" viewBox="0 0 80 120">
    <use :href="href" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { idFromSymbol } from "@/utils/idFromSymbol"; // mapping court → id

const props = withDefaults(
  defineProps<{
    card: string; // ex: "K♣", "10♦", "back"
    width?: number;
    height?: number;
  }>(),
  {
    width: 80,
    height: 120,
  }
);

const href = computed(() => `#${idFromSymbol(props.card)}`);
</script>
