<template>
  <div class="flex flex-col items-center">
    <Card v-if="topCard" :rank="topCard.rank" :suit="topCard.suit" />
    <div class="text-xs text-gray-600 mt-1">
      {{ pileSize }} carte{{ pileSize > 1 ? "s" : "" }} restante{{
        pileSize > 1 ? "s" : ""
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from "./Card.vue";
import type { CardData } from "@/game/types";

defineProps<{
  topCard: CardData | undefined;
  pileSize: number;
}>();
</script>
