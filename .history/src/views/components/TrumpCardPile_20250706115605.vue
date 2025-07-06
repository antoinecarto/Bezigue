<script setup lang="ts">
import { useGameStore } from "@/stores/game";
import { computed } from "vue";
import PlayingCard from "@/components/cards/PlayingCard.vue";

const game = useGameStore();
const trump = computed(() => game.room?.trumpCard.split("_")[0] ?? "back");
const remaining = computed(() => game.room?.deck.length ?? 0);
(window as any).game = game; // expose dans la console

function draw() {
  if (game.canDraw) game.drawCard(); // action Pinia ⇢ transaction Firestore
}
</script>

<template>
  <div class="flex flex-col items-center">
    <PlayingCard
      :code="trump"
      v-if="trump"
      :width="80"
      :height="110"
      class="mb-1"
    />

    <button
      class="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-40"
      @click="draw"
      :disabled="!game.canDraw"
    >
      Piocher ({{ remaining }})
    </button>
  </div>
</template>
