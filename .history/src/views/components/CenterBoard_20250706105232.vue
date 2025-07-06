<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import TargetSelector from "./TargetSelector.vue";
import TrumpCardPile from "./TrumpCardPile.vue";
import ExchangeDialog from "./ExchangeDialog.vue";

const game = useGameStore();

const scores = computed(() => game.room?.scores ?? {});
const playerNames = computed(() => game.room?.playerNames ?? {});
</script>

<template>
  <!-- SCOREBOARD ---------------------------------------------------- -->
  <div class="scoreboard flex justify-center gap-12 mb-4">
    <div
      v-for="[uid, pts] in Object.entries(scores)"
      :key="uid"
      class="text-center"
    >
      <p class="font-semibold">{{ playerNames[uid] || "Joueur" }}</p>
      <p class="text-2xl font-bold">{{ pts }}</p>
    </div>
  </div>

  <!-- TARGET SELECTOR (1000 / 2000) -------------------------------- -->
  <TargetSelector />

  <!-- PIOCHE + TRUMP CARD ----------------------------------------- -->
  <TrumpCardPile class="mt-6" />

  <!-- POPUP ÉCHANGE 7 D’ATOUT ------------------------------------- -->
  <ExchangeDialog v-if="game.showExchange" />
</template>

<style scoped>
.scoreboard p {
  line-height: 1;
}
</style>
