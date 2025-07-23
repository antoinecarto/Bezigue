<template>
  <draggable
    :list="handArray"
    :item-key="(c) => c"
    class="player-hand"
    :group="{ name: 'cards', pull: true, put: true }"
    :sort="false"
    @add="onCardDroppedBackToHand"
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
import { ref, computed } from "vue";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";
import PlayingCard from "@/views/components/PlayingCard.vue";

const game = useGameStore();
const { myUid, hand, currentTurn } = storeToRefs(game);

const showNotYourTurn = ref(false);
const playing = ref(false);
const isMyTurn = computed(() => currentTurn.value === myUid.value);

// Assurez-vous que `hand` est un tableau
const handArray = computed(() => {
  if (Array.isArray(hand.value)) {
    return hand.value;
  } else if (typeof hand.value === "object" && hand.value !== null) {
    return Object.values(hand.value);
  } else {
    return [];
  }
});

function onCardDroppedBackToHand(evt) {
  const addedCard = evt.added?.element;
  if (!addedCard) {
    console.warn("Aucune carte ajoutée détectée.");
    return;
  }

  console.log("Carte ajoutée à la main :", addedCard);

  // Assurez-vous que la carte n'est pas déjà dans la main
  if (!handArray.value.includes(addedCard)) {
    console.log("Tentative de suppression de la carte du meld :", addedCard);
    game.removeFromMeldAndReturnToHand(myUid.value, addedCard);
  } else {
    console.warn("La carte est déjà dans la main.");
  }
}

function onCardClick(code: string) {
  if (!isMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }
  if (playing.value) return;
  game.playCard(code).catch((err) => {
    console.error("Erreur lors du jeu de la carte", err);
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
