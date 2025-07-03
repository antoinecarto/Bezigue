<template>
  <div class="player-hand flex gap-2 overflow-x-auto px-2">
    <div v-for="(card, index) in cards" :key="index" @click="play(card)" class="flex-shrink-0">
      <Card :rank="card.rank" :suit="card.suit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from './Card.vue'

defineProps<{
  cards: { rank: string; suit: "♦" | "♣" | "♠" | "♥" }[];
}>();

const emit = defineEmits(["playCard"]);

function play(card: { rank: string; suit: "♦" | "♣" | "♠" | "♥" }) {
  emit("playCard", card);
}
</script>

<style scoped>
.player-hand {
  /* Permet de faire défiler horizontalement si trop large */
  max-width: 100%;
  /* optionnel : pour bien aligner verticalement les cartes */
  align-items: center;
}
.flex-shrink-0 {
  flex-shrink: 0; /* Empêche les cartes de rapetisser */
}
</style>




