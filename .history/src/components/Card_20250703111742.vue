<template>
  <img
    :src="imgSrc"
    alt=""
    class="card"
    draggable="false"
    @click="$emit('click')"
  />
</template>

<script setup lang="ts">
import { Card } from "@/game/types/Card";

const props = defineProps<{
  code: string; // "K♠", "10♦", "back"
  copy?: 1 | 2; // n° de la carte si tu veux afficher la 2ᵉ copie
}>();

// Face verso
const imgSrc =
  props.code === "back"
    ? "/cards/back.png"
    : `/cards/${Card.fileNameFromCode(props.code, props.copy ?? 1)}`;
</script>

<style scoped>
.card {
  width: 80px;
  height: 120px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  user-select: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.card:hover {
  transform: scale(1.08);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
}
</style>
