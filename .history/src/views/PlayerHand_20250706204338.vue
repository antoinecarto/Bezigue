<template>
  <draggable
    v-model="cards"
    :item-key="cardKey"
    :animation="200"
    class="player-hand"
    :group="{ name: 'cards' }"
    @end="onEnd"
  >
    <!-- element = string "A♠_1"  -->
    <template #item="{ element }">
      <PlayingCard
        :code="element"
        :key="element"
        :width="70"
        :height="100"
        class="{ disabled: !isMyTurn } cursor-pointer"
        @click="onCardClick(element)"
      />
      <Popup v-if="showNotYourTurn" @close="showNotYourTurn = false">
        Ce n'est pas votre tour !
      </Popup>
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

/* tableau réactif local utilisé par v‑model */
const cards = ref<string[]>([]);

/* sync : store ⇒ composant */
watch(
  hand,
  (newHand) => {
    cards.value = newHand ?? [];
  },
  { immediate: true }
);

/* clé unique pour draggable (la carte elle‑même) */
const cardKey = (c: string) => c;

function onEnd() {
  // si tu veux sauvegarder le nouvel ordre dans Firestore
  game.updateHand(cards.value);
}

function onCardClick(code: string) {
  if (!code) return; // garde‑fou
  console.log("clic:", code);
  game.playCard(code);
  console.log("hand local =", hand.value);
  console.log("carte cliquée =", code);
}
</script>

<style scoped>
.player-hand {
  display: flex;
  gap: 8px;
}
</style>
