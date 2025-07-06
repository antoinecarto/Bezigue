<template>
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
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";

const game = useGameStore();

const exchangeTable = computed(() => game.room?.exchangeTable || {});
const playerNames = computed(() => game.room?.playerNames || {});
const trumpCard = computed(() => game.room?.trumpCard ?? "");
</script>
