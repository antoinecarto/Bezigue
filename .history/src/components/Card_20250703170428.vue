<template>
  <img src="/cards/QC_1.svg" alt="test card" width="60" height="90" />
</template>

<script setup lang="ts">
onMounted(() => {
  console.log("[Card] MOUNTED !");
});
import { computed, onMounted } from "vue";
import { fileNameFromCode } from "@/game/types/Card.ts";

const props = defineProps<{
  code: string; // "K♠", "10♦", "back"
  copy?: 1 | 2; // n° de la carte si tu veux afficher la 2ᵉ copie
  width?: number;
  height?: number;
}>();
const width = props.width ?? 60;
const height = props.height ?? 80;

// Face verso
const imgSrc = computed(() =>
  props.code === "back"
    ? "/cards/back.svg"
    : `/cards/${fileNameFromCode(props.code, props.copy ?? 1)}`
);

console.log("[Card] code =", props.code, " copy =", props.copy);
console.log("[Card] imgSrc =", imgSrc);
</script>

<style scoped>
.card {
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  user-select: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  display: block;
  max-width: none; /* important */
}

.card:hover {
  transform: scale(1.08);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
}
</style>
