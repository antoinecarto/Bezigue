<template>
  <draggable
    v-model="cards"
    item-key="code"
    :animation="200"
    class="player-hand"
    :group="{ name: 'cards' }"
    @end="onEnd"
  >
    <template #item="{ element, index }">
      <PlayingCard
        :code="element"
        :key="element"
        @click="onCardClick(element)"
      />
    </template>
  </draggable>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, watch } from "vue";
import { useGameStore } from "@/stores/game.ts";
import { storeToRefs } from "pinia";
import PlayingCard from "@/views/components/PlayingCard.vue";

const game = useGameStore();
const { myUid, hand } = storeToRefs(game);

const userId = myUid.value!;
const cards = ref(hand.value || []);

watch(
  () => game.hand[userId],
  (newHand) => {
    cards.value = newHand || [];
  }
);

function onEnd() {
  game.updateHand(userId, cards.value);
}

function onCardClick(code: string) {
  game.playCard(code);

  console.log("Carte cliquée:", code);
  // Si besoin, tu peux faire d'autres actions ici
}
</script>

<style scoped>
.player-hand {
  display: flex;
  gap: 8px;
}
</style>
