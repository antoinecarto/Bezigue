<!-- CapturedCards.vue -->
<template>
  <div class="flex flex-col items-center w-full p-2 border rounded bg-gray-50">
    <div class="text-sm font-medium text-gray-700 mb-1">
      Plis gagnés par : Joueur {{ player }}
    </div>

    <div class="flex flex-wrap justify-center gap-1 mb-1">
      <Card
        v-for="(card, index) in plis"
        :key="`${player}-plis-${index}`"
        :rank="card.rank"
        :suit="card.suit"
      />
    </div>

    <!-- Nombre de plis -->
    <div class="text-xs text-gray-600">
      {{ Math.floor(plis.length / 2) }} pli{{
        Math.floor(plis.length / 2) > 1 ? "s" : ""
      }}
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from "./Card.vue";
import { defineProps } from "vue";
import type { CardData } from "@/game/types";

defineProps<{
  player: number;
  plis: CardData[];
}>();
</script>
