<template>
  <draggable
    v-model="cards"
    :item-key="cardKey"
    :animation="200"
    class="player-hand"
    :group="{ name: 'cards' }"
    @end="onEnd"
    :disabled="!isMyTurn"
  >
    <!-- element = string "A♠_1"  -->
    <template #item="{ element }">
      <PlayingCard
        :code="element"
        :key="element"
        :width="70"
        :height="100"
        :class="[{ disabled: !isMyTurn }, 'cursor-pointer']"
        @click="onCardClick(element)"
      />
    </template>
  </draggable>

  <!-- Popup simple -->
  <div v-if="showNotYourTurn" class="popup">
    Ce n'est pas votre tour !
    <button @click="showNotYourTurn = false">OK</button>
  </div>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, watch, computed } from "vue";
import { useGameStore } from "@/stores/game.ts";
import { storeToRefs } from "pinia";
import PlayingCard from "@/views/components/PlayingCard.vue";

const game = useGameStore();
const { myUid, hand, currentTurn } = storeToRefs(game);

const cards = ref<string[]>([]);

watch(
  hand,
  (newHand) => {
    cards.value = newHand ?? [];
  },
  { immediate: true }
);

const cardKey = (c: string) => c;

const showNotYourTurn = ref(false);
const playing = ref(false);

// Calcul du tour du joueur
const isMyTurn = computed(() => currentTurn.value === myUid.value);

function onEnd() {
  game.updateHand(cards.value);
}

function onCardClick(code: string) {
  if (!isMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }
  if (playing.value) return; // déjà une carte en cours

  // enlève immédiatement du hand local
  const idx = hand.value.indexOf(code);
  if (idx !== -1) hand.value.splice(idx, 1);

  game.playCard(code).catch((err) => {
    // si la TX échoue, on remet la carte
    hand.value.splice(idx, 0, code);
    console.error(err);
  });
}
</script>

<style scoped>
.player-hand {
  display: flex;
  gap: 8px;
}

.disabled {
  pointer-events: none;
  opacity: 0.5;
  cursor: not-allowed;
}

.popup {
  position: fixed;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border: 2px solid black;
  padding: 1em 2em;
  z-index: 100;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
}

.disabled {
  opacity: 0.5;
  pointer-events: none; /* pour que le clic ne passe pas */
  cursor: not-allowed;
}
</style>
