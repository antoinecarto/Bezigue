<script setup lang="ts">
import { ref, computed } from "vue";
import { useGameStore } from "@/stores/game";
import TargetSelector from "./TargetSelector.vue";
import TrumpCardPile from "./TrumpCardPile.vue";
import ExchangeDialog from "./Exchange7Dialog.vue";
import PlayingCard from "@/views/components/PlayingCard.vue";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase"; // ou ajuste selon ton chemin

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

/* Ajout de score -------------------------------------------------- */
const selectedScore = ref<number | null>(null);

async function addScore() {
  const room = game.room;
  const uid = game.myUid;
  if (!room || !uid || !selectedScore.value) return;

  const roomRef = doc(db, "rooms", room.id);
  const currentScore = room.scores?.[uid] ?? 0;
  const newScore = currentScore + selectedScore.value;
  const meldCards = room.melds?.[uid] ?? 0;

  await updateDoc(roomRef, {
    [`scores.${uid}`]: newScore,
    [`melds.${uid}`]: meldCards, // `meldCards` = tableau des cartes déposées
  });

  selectedScore.value = null; // reset le select
}
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
      <!-- Sélecteur simple de score -->
      <div class="mt-4 text-white">
        <label class="block mb-1">Ajouter des points :</label>
        <select
          v-model="selectedScore"
          class="px-2 py-1 rounded text-black block"
        >
          <option disabled selected value="">-- Choisir un score --</option>
          <option
            v-for="val in [20, 40, 60, 80, 100, 150, 250, 500]"
            :key="val"
            :value="val"
          >
            {{ val }} points
          </option>
        </select>
        <button
          class="mt-2 block px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
          :disabled="!selectedScore"
          @click="addScore"
        >
          Ajouter au score
        </button>
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
  padding-top: 60px;
}
</style>
