<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import TargetSelector from "./TargetSelector.vue";
import TrumpCardPile from "./TrumpCardPile.vue";
import ExchangeDialog from "./Exchange7Dialog.vue";
import PlayingCard from "@/views/components/PlayingCard.vue";

const game = useGameStore();

/* scores & noms ------------------------------------------------- */
const scores = computed(() => {
  const r = game.room;
  if (!r) return {};
  return Object.fromEntries(
    r.players.map((uid) => [uid, r.scores?.[uid] ?? 0])
  );
});
const playerNames = computed(() => {
  const r = game.room;
  if (!r) return {};
  return Object.fromEntries(
    r.players.map((uid) => [uid, r.playerNames?.[uid] ?? "Joueur"])
  );
});

/* cartes jouées -------------------------------------------------- */
const exchangeTable = computed(() => game.room?.exchangeTable ?? {});
</script>

<template>
  <!-- TAPIS VERT GLOBAL ------------------------------------------ -->
  <div class="table-green flex justify-between items-start px-8 py-6 mb-6">
    <!-- COLONNE GAUCHE : score + rappel -->
    <div class="flex flex-col gap-5">
      <div class="scoreboard flex gap-10">
        <div
          v-for="[uid, pts] in Object.entries(scores)"
          :key="uid"
          class="text-center"
        >
          <p class="text-white">{{ playerNames[uid] }}</p>
          <p class="text-2xl text-white">{{ pts }}</p>
        </div>
      </div>

      <TargetSelector />
    </div>

    <!-- NOUVELLE COLONNE CENTRALE : cartes jouées -->
    <div class="center-cards flex gap-4 items-center">
      <PlayingCard
        v-for="(cardCode, uid) in exchangeTable"
        :key="uid"
        :code="cardCode"
        :width="70"
        :height="100"
      />
    </div>

    <!-- COLONNE DROITE : TrumpCardPile -->
    <TrumpCardPile />
  </div>

  <!-- POPUP ÉCHANGE 7 D’ATOUT ------------------------------------ -->
  <ExchangeDialog v-if="game.showExchange" />
</template>

<style scoped>
.table-green {
  background: radial-gradient(circle at 30% 30%, #116d30 0%, #0c4f28 80%);
  border: 5px solid #083d1d;
  border-radius: 16px;
  min-height: 180px;
}

.scoreboard p {
  line-height: 1;
}

.center-cards {
  padding-top: 30px; /* descend un peu la colonne */
}
</style>
