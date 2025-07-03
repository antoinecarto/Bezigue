<script setup lang="ts">
import { computed } from "vue";
import { Card } from "@/utils/Card";

const props = withDefaults(
  defineProps<{
    card: string; // "K♣", "10♦", "back"
    width?: number;
    height?: number;
  }>(),
  { width: 80, height: 120 }
);

/* chemin complet + id réel */
const href = computed(
  () => `/cards/svg-cards-2.0.svg#${Card.spriteIdFromCode(props.card)}`
);
</script>

<template>
  <svg :width="props.width" :height="props.height" viewBox="0 0 80 120">
    <use :href="href" />
  </svg>
</template>
