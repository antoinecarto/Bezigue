<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import TargetSelector from "./TargetSelector.vue";
import TrumpCardPile from "./TrumpCardPile.vue";
import ExchangeDialog from "./Exchange7Dialog.vue";
import PlayingCard from "@/views/components/PlayingCard.vue";

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
  <!-- 1. SCOREBOARD ------------------------------------------------ -->
  <div class="scoreboard flex justify-center gap-12 mb-3">
    <div
      v-for="[uid, pts] in Object.entries(scores)"
      :key="uid"
      class="text-center"
    >
      <p class="font-semibold">{{ playerNames[uid] }}</p>
      <p class="text-2xl font-bold">{{ pts }}</p>
    </div>
  </div>

  <!-- 2. RAPPEL PARTIE 1000/2000 ---------------------------------- -->
  <TargetSelector class="mb-4" />

  <!-- 3. TAPIS VERT : cartes jouées + atout ------------------------ -->
  <div class="table-green flex items-center justify-between px-6 py-3 mb-6">
    <!-- cartes jouées (gauche) -->
    <div class="flex gap-4">
      <PlayingCard
        v-for="(cardCode, uid) in exchangeTable"
        :key="uid"
        :code="cardCode"
        :width="70"
        :height="100"
      />
    </div>

    <!-- atout + pioche (droite) -->
    <TrumpCardPile />
  </div>

  <!-- 4. POPUP ÉCHANGE 7 D’ATOUT ----------------------------------- -->
  <ExchangeDialog v-if="game.showExchange" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import TargetSelector from "./TargetSelector.vue";
import TrumpCardPile from "./TrumpCardPile.vue";
import ExchangeDialog from "./Exchange7Dialog.vue";
import PlayingCard from "@/components/cards/PlayingCard.vue";

const game = useGameStore();

const scores = computed(() => {
  const r = game.room;
  if (!r) return {};
  const out: Record<string, number> = {};
  r.players.forEach((uid) => (out[uid] = r.scores?.[uid] ?? 0));
  return out;
});

const playerNames = computed(() => {
  const r = game.room;
  if (!r) return {};
  const out: Record<string, string> = {};
  r.players.forEach((uid) => (out[uid] = r.playerNames?.[uid] ?? "Joueur"));
  return out;
});

const exchangeTable = computed(() => game.room?.exchangeTable ?? {});
</script>

<style scoped>
.scoreboard p {
  line-height: 1;
}

.table-green {
  background: radial-gradient(circle at 30% 30%, #116d30 0%, #0c4f28 70%);
  border: 5px solid #083d1d;
  border-radius: 16px;
  min-height: 140px;
}
.center-wrapper {
  align-items: flex-start;
}
.exchange-table {
  background: #0a4d0a;
  padding: 10px 16px;
  border-radius: 8px;
}
.scoreboard p {
  line-height: 1;
}
.scoreboard p {
  line-height: 1;
}

.exchange-table {
  background: #0a4d0a; /* tapis vert */
  padding: 10px 20px;
  border-radius: 8px;
}
</style>
