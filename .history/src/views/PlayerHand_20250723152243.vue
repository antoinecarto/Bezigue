<template>
  <draggable
    v-model="handArrayRef"
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

const showNotYourTurn = ref(false);
const playing = ref(false);
const isMyTurn = computed(() => currentTurn.value === myUid.value);

// 🌟 Nouveau ref local manipulable
const handArrayRef = ref<string[]>([]);

// 🔄 Synchronisation main <-> store
watch(
  () => hand.value,
  (newHand) => {
    if (Array.isArray(newHand)) {
      handArrayRef.value = newHand;
    } else if (typeof newHand === "object" && newHand !== null && myUid.value) {
      handArrayRef.value = newHand[myUid.value] || [];
    } else {
      handArrayRef.value = [];
    }
  },
  { immediate: true, deep: true }
);

// // 🔄 Également, sync les modifs utilisateur vers le store
// watch(
//   handArrayRef,
//   (newArray) => {
//     if (
//       hand.value &&
//       typeof hand.value === "object" &&
//       !Array.isArray(hand.value) &&
//       myUid.value
//     ) {
//       // Mise à jour de la main du joueur dans l'objet global
//       hand.value[myUid.value] = newArray;
//     }
//   },
//   { deep: true }
// );

function onCardDroppedBackToHand(evt: any) {
  const addedCard = evt.item?.__draggable_context?.element;
  console.log("addedCard : ", addedCard);
  if (!addedCard) {
    console.warn("Aucune carte ajoutée détectée.");
    return;
  }

  console.log("Carte ajoutée à la main :", addedCard);

  if (!handArrayRef.value.includes(addedCard)) {
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
