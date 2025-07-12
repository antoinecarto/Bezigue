<template>
  <!-- main draggable hand: toujours ré‑ordonnable, mais on ne peut sortir
       une carte vers la MeldZone que si canDragOut === true -->
  <draggable
    v-model="cards"
    :item-key="cardKey"
    class="player-hand"
    :animation="200"
    :group="{ name: 'cards', pull: canDragOut, put: false }"
    @end="onEnd"
  >
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

  <!-- Popup tour adverse -->
  <div v-if="showNotYourTurn" class="popup">
    Ce n'est pas votre tour !
    <button @click="showNotYourTurn = false">OK</button>
  </div>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, computed, watch } from "vue";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";
import PlayingCard from "@/views/components/PlayingCard.vue";

const game = useGameStore();
const { myUid, hand, currentTurn } = storeToRefs(game);
const room = computed(() => game.room);

/* ---------------- cartes locales pour vuedraggable ------------- */
const cards = ref<string[]>([]);
watch(hand, (h) => (cards.value = [...h]), { immediate: true });

const cardKey = (c: string) => c;

/* ---------------- états UI ---------------- */
const showNotYourTurn = ref(false);
const playing = ref(false);

const isMyTurn = computed(() => currentTurn.value === myUid.value);
const canDragOut = computed(() => isMyTurn.value);

/* -------------------------------------------------------------- */
function onEnd() {
  // réenregistre l'ordre local dans Firestore
  game.updateHand(cards.value);
}

function onCardClick(code: string) {
  if (!isMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }
  if (playing.value) return; // already playing

  const idx = hand.value.indexOf(code);
  if (idx !== -1) hand.value.splice(idx, 1);

  game.playCard(code).catch((err) => {
    hand.value.splice(idx, 0, code); // rollback en cas d'erreur
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
</style>
