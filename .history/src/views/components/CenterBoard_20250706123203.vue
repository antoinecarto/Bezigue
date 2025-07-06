<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import TargetSelector from "./TargetSelector.vue";
import TrumpCardPile from "./TrumpCardPile.vue";
import ExchangeDialog from "./Exchange7Dialog.vue";

const game = useGameStore();

/* 🟢 1. toujours retourner un score pour chaque joueur */
const scores = computed(() => {
  const r = game.room;
  if (!r) return {};
  const out: Record<string, number> = {};
  r.players.forEach((uid) => {
    out[uid] = r.scores?.[uid] ?? 0;
  });
  return out; // 👉 objet toujours rempli
});

/* 🟢 2. même principe pour les noms */
const playerNames = computed(() => {
  const r = game.room;
  if (!r) return {};
  const out: Record<string, string> = {};
  r.players.forEach((uid) => {
    out[uid] = r.playerNames?.[uid] ?? "Joueur";
  });
  return out;
});
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
  <!-- EXCHANGE TABLE : cartes jouées par chaque joueur -->
  <div class="exchange-table flex justify-center gap-6 mb-6">
    <div
      v-for="(cardCode, uid) in exchangeTable"
      :key="uid"
      class="flex flex-col items-center"
    >
      <PlayingCard :code="cardCode" :width="70" :height="100" />
      <span class="text-sm mt-1">{{ playerNames[uid] || "Joueur" }}</span>
    </div>

    <!-- La carte d'atout à droite -->
    <div class="ml-10 flex flex-col items-center">
      <PlayingCard :code="trumpCard" :width="70" :height="100" />
      <span class="text-sm mt-1">Atout</span>
    </div>
  </div>

  <!-- PIOCHE + TRUMP CARD ----------------------------------------- -->
  <div style="border: 1px solid red">
    <TrumpCardPile class="mt-6" />
  </div>

  <!-- POPUP ÉCHANGE 7 D’ATOUT ------------------------------------- -->
  <ExchangeDialog v-if="game.showExchange" />
</template>

<style scoped>
.scoreboard p {
  line-height: 1;
}
</style>
