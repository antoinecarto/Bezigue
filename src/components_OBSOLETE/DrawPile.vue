<template>
  <div class="flex flex-col items-center">
    <Card v-if="topCard" :code="topCard.rank + topCard.suit" />
    <div class="text-xs text-gray-600 mt-1">
      {{ pileSize }} carte{{ pileSize > 1 ? "s" : "" }} restante{{
        pileSize > 1 ? "s" : ""
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from "./Card.vue";

defineProps<{
  topCard?: { rank: string; suit: "♦" | "♣" | "♠" | "♥" };
  pileSize: number;
}>();
</script>
