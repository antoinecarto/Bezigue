<template>
  <!-- EXCHANGE TABLE : cartes jouées par chaque joueur -->
  <div class="exchange-table flex justify-center gap-6 mb-6">
    <!-- cartes déposées par chaque joueur -->
    <div
      v-for="(cardCode, uid) in exchangeTable"
      :key="uid"
      class="flex flex-col items-center"
    >
      <PlayingCard :code="cardCode" :width="70" :height="100" />
      <span class="text-sm mt-1">{{ playerNames[uid] ?? "Joueur" }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game";
import PlayingCard from "@/components/cards/PlayingCard.vue";

const game = useGameStore();

const exchangeTable = computed(() => game.room?.exchangeTable ?? {});
const playerNames = computed(() => game.room?.playerNames ?? {});
const trumpCard = computed(() => game.room?.trumpCard?.split("_")[0] ?? "back");
</script>

<style scoped>
.exchange-table {
  background: #0a4d0a; /* tapis vert */
  padding: 10px 20px;
  border-radius: 8px;

  margin: 20px auto;     /* marge verticale de 20px, centrage horizontal auto */
  max-width: 600px;      /* largeur max pour éviter que ça s’étale trop */

  box-sizing: border-box; /* au cas où */
</style>
