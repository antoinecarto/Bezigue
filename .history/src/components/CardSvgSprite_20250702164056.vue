<template>
  <svg :width="width" :height="height" viewBox="0 0 80 120">
    <use :href="href" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Card } from "@/game/types/Card";

const href = computed(
  () => `/cards/svg-cards-2.0.svg#${Card.spriteIdFromCode(props.card)}`
);

const props = withDefaults(
  defineProps<{
    card: string; // "Q♣", "10♦", "back"…
    width?: number;
    height?: number;
  }>(),
  { width: 80, height: 120 }
);

const spriteId = computed(() => Card.spriteIdFromCode(props.card));
const w = props.width;
const h = props.height;
</script>
