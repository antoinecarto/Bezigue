<template>
  <draggable
    v-model="game.hand"
    :item-key="(c :string) => c"
    class="player-hand"
    :group="{ name: 'cards', pull: true, put: true }"
    :sort="true"
    @add="onCardDroppedBackToHand"
    @end="onDragEnd"
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
    Patience, votre adversaire n'a pas encore pioché...
    <button @click="showNotYourTurn = false">OK</button>
  </div>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, computed, watch } from "vue";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

const game = useGameStore();
const { myUid, hand, drawQueue, currentTurn, room } = storeToRefs(game);

const showNotYourTurn = ref(false);
const playing = ref(false);

watch(drawQueue, (val) => {
  console.log("🎯 drawQueue changed", val);
  console.log("🧠 isNotMyTurn:", isNotMyTurn.value);
  console.log("👤 myUid:", myUid.value);
});

const isMyTurn = computed(() => currentTurn.value === myUid.value);
const isNotMyTurn = computed(() => {
  return drawQueue.value.length === 1 && drawQueue.value[0] !== myUid.value;
});
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

// 🔄 Également, sync les modifs utilisateur vers le store
watch(
  handArrayRef,
  (newArray) => {
    if (
      hand.value &&
      typeof hand.value === "object" &&
      !Array.isArray(hand.value) &&
      myUid.value
    ) {
      // Mise à jour de la main du joueur dans l'objet global
      hand.value[myUid.value] = newArray;
    }
  },
  { deep: true }
);

async function onDragEnd() {
  if (!room.value || !myUid.value) return;

  const roomRef = doc(db, "rooms", room.value.id);

  await updateDoc(roomRef, {
    [`hands.${myUid.value}`]: hand.value, // ou simplement `hand` si pas ref
  });
}

function onCardDroppedBackToHand(evt: any) {
  const addedCard = evt.item?.__draggable_context?.element;
  if (!addedCard) {
    console.warn("Aucune carte ajoutée détectée.");
    return;
  }

  console.log("Carte ajoutée à la main :", addedCard);

  console.log("Tentative de suppression de la carte du meld :", addedCard);
  game.removeFromMeldAndReturnToHand(myUid.value, addedCard);
}

function onCardClick(code: string) {
  console.log("drawQueue:", drawQueue.value);
  console.log("currentTurn:", currentTurn.value);
  console.log("myUid:", myUid.value);
  console.log("isNotMyTurn:", isNotMyTurn.value);
  if (isNotMyTurn.value) {
    console.log("Popup affichée car ce n'est pas ton tour");

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
