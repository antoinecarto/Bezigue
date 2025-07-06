<template>
  <div class="player-hand flex gap-2 overflow-x-auto px-2">
    <div
      v-for="card in props.cards"
      :key="card.rank + card.suit"
      @click="play(card)"
      class="flex-shrink-0"
    >
      <Card :code="card.rank + card.suit" :width="60" :height="90" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Card from "./Card.vue";

const props = defineProps<{
  cards: { rank: string; suit: "♦" | "♣" | "♠" | "♥" }[];
}>();

const emit = defineEmits(["playCard"]);

function play(card: { rank: string; suit: "♦" | "♣" | "♠" | "♥" }) {
  emit("playCard", card);
}
</script>

<style scoped>
.player-hand {
  max-width: 100%;
  align-items: center;
}
.flex-shrink-0 {
  flex-shrink: 0;
}
</style>
