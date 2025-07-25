<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import TargetSelector from "./TargetSelector.vue";
import TrumpCardPile from "./TrumpCardPile.vue";
import ExchangeDialog from "./Exchange7Dialog.vue";
import PlayingCard from "@/views/components/PlayingCard.vue"; // pour afficher les cartes

const game = useGameStore();

/* 1. Scores */
const scores = computed(() => {
  const r = game.room;
  if (!r) return {};
  const obj: Record<string, number> = {};
  r.players.forEach((uid) => {
    obj[uid] = r.scores?.[uid] ?? 0;
  });
  return obj;
});

/* 2. Noms */
const playerNames = computed(() => {
  const r = game.room;
  if (!r) return {};
  const obj: Record<string, string> = {};
  r.players.forEach((uid) => {
    obj[uid] = r.playerNames?.[uid] ?? "Joueur";
  });
  return obj;
});

/* 3. Table d’échange (cartes jouées) + atout */
const exchangeTable = computed(() => game.room?.exchangeTable ?? {});
const trumpCard = computed(() => game.room?.trumpCard?.split("_")[0] ?? "back");
</script>

<template>
  <!-- SCOREBOARD ---------------------------------------------------- -->
  <div class="scoreboard flex justify-center gap-12 mb-4">
    <div
      v-for="[uid, pts] in Object.entries(scores)"
      :key="uid"
      class="text-center"
    >
      <p class="font-semibold">{{ playerNames[uid] }}</p>
      <p class="text-2xl font-bold">{{ pts }}</p>
    </div>
  </div>

  <!-- TARGET SELECTOR ---------------------------------------------- -->
  <TargetSelector />

  <!-- EXCHANGE TABLE ------------------------------------------------ -->
  <div class="exchange-table flex justify-center gap-6 my-6">
    <!-- cartes jouées -->
    <div
      v-for="(cardCode, uid) in exchangeTable"
      :key="uid"
      class="flex flex-col items-center"
    >
      <PlayingCard :code="cardCode" :width="70" :height="100" />
      <span class="text-sm mt-1">{{ playerNames[uid] }}</span>
    </div>

    <!-- carte d'atout -->
    <div class="ml-10 flex flex-col items-center">
      <PlayingCard :code="trumpCard" :width="70" :height="100" />
      <span class="text-sm mt-1">Atout</span>
    </div>
  </div>

  <!-- PIOCHE -------------------------------------------------------- -->
  <TrumpCardPile class="mt-6" />

  <!-- POPUP ÉCHANGE 7 D’ATOUT -------------------------------------- -->
  <ExchangeDialog v-if="game.showExchange" />
</template>

<style scoped>
.scoreboard p {
  line-height: 1;
}

.exchange-table {
  background: #0a4d0a; /* tapis vert */
  padding: 10px 20px;
  border-radius: 8px;
}
</style>
