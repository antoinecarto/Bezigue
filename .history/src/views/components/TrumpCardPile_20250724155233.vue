<script setup lang="ts">
import { useGameStore } from "@/stores/game";
import { computed } from "vue";
import PlayingCard from "@/views/components/PlayingCard.vue";

const game = useGameStore();
const trump = computed(() => {
  return game.room?.trumpCard ?? "back";
});

const remaining = computed(() => game.room?.deck.length ?? 0);
(window as any).game = game; // expose dans la console
</script>

<template>
  <div class="trump-card flex flex-col items-center">
    <PlayingCard
      :code="trump"
      v-if="trump"
      :width="80"
      :height="110"
      class="mb-1"
    />

    <button
      :disabled="!game.canDraw()"
      @click="game.drawCard"
      class="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-40"
    >
      Piocher ({{ remaining }})
    </button>
  </div>
</template>

<style>
.trump-card {
  border: 6px solid black; /* cadre large noir */
  border-radius: 8px; /* coins arrondis, optionnel */
  padding: 12px; /* espace intérieur autour de la carte */
  margin: 16px; /* espace extérieur pour ne pas coller aux autres éléments */
  box-sizing: border-box; /* inclure la bordure et padding dans la taille */
  background-color: radial-gradient(circle at 30% 30%, #116d30 0%, #0c4f28 50%);
  display: inline-block; /* ou block selon contexte */
}
</style>
