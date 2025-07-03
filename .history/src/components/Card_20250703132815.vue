<template>
  <img
    :src="imgSrc"
    alt=""
    class="card"
    draggable="false"
    @click="$emit('click')"
    :style="{ width: width + 'px', height: height + 'px' }"
  />
</template>

<script setup lang="ts">
import { Card } from "@/game/types/Card";

const props = defineProps<{
  code: string; // "K♠", "10♦", "back"
  copy?: 1 | 2; // n° de la carte si tu veux afficher la 2ᵉ copie
  width?: number;
  height?: number;
}>();
const width = props.width ?? 80;
const height = props.height ?? 120;

// Face verso
const imgSrc =
  props.code === "back"
    ? "/cards/back.svg"
    : `/cards/${Card.fileNameFromCode(props.code, props.copy ?? 1)}`;
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
