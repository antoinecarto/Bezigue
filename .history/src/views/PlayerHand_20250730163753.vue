<template>
  <draggable
    v-model="localHand"
    :item-key="(c: string) => c"
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

  <div v-if="showNotYourTurn" class="popup text-black dark:text-black">
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

const game = useGameStore();
const { myUid, hand, drawQueue, currentTurn } = storeToRefs(game);

const showNotYourTurn = ref(false);
const playing = ref(false);

const showMustDrawFirst = ref(false);

const mustDrawFirst = computed(() => {
  return drawQueue.value.includes(myUid.value); // Il doit piocher s'il est dans la drawQueue
});

const isMyTurn = computed(() => currentTurn.value === myUid.value);
const isNotMyTurn = computed(() => {
  return drawQueue.value.length === 1 && drawQueue.value[0] !== myUid.value;
});

// ✅ CORRECTION PRINCIPALE : ref local synchronisé avec le store
const localHand = ref<string[]>([]);

// ✅ Synchronisation unidirectionnelle : store -> composant
watch(
  () => hand.value,
  (newHand) => {
    if (Array.isArray(newHand)) {
      localHand.value = [...newHand];
    } else {
      localHand.value = [];
    }
  },
  { immediate: true, deep: true }
);

// ✅ Synchronisation : composant -> store (seulement quand nécessaire)
async function syncHandToStore() {
  if (!myUid.value || !Array.isArray(localHand.value)) return;

  try {
    await game.updateHand(localHand.value);
  } catch (error) {
    console.error("Erreur lors de la synchronisation de la main:", error);
    // En cas d'erreur, remettre la main dans l'état du store
    if (Array.isArray(hand.value)) {
      localHand.value = [...hand.value];
    }
  }
}

async function onDragEnd() {
  // ✅ Synchroniser après un drag & drop
  await syncHandToStore();
}

function onCardDroppedBackToHand(evt: any) {
  const addedCard = evt.item?.__draggable_context?.element;
  if (!addedCard) {
    console.warn("Aucune carte ajoutée détectée.");
    return;
  }
  if (!myUid.value) {
    console.warn("UID manquant");
    return;
  }

  // ✅ Gestion plus propre des cartes ajoutées
  const cardCode = Array.isArray(addedCard) ? addedCard[0] : addedCard;

  // Utiliser la fonction du store qui gère déjà Firestore
  game.removeFromMeldAndReturnToHand(myUid.value, cardCode);
}

async function onCardClick(code: string) {
  if (isNotMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }

  if (mustDrawFirst.value) {
    showMustDrawFirst.value = true;
    return;
  }
  if (playing.value) return;

  playing.value = true;

  try {
    await game.playCard(code);
  } catch (err) {
    console.error("Erreur lors du jeu de la carte", err);
  } finally {
    playing.value = false;
  }
}
</script>

<style scoped>
.player-hand {
  display: flex;
  gap: 8px;
  min-height: 100px; /* Pour éviter les sauts visuels */
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
  border-radius: 8px;
}

.popup button {
  margin-left: 10px;
  padding: 5px 10px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.popup button:hover {
  background: #0056b3;
}
</style>
