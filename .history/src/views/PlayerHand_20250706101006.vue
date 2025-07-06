<template>
  <draggable
    v-model="cards"
    item-key="code"
    :animation="200"
    class="player-hand"
    :group="{ name: 'cards' }"
  >
    <template #item="{ element, index }">
      <div class="card" :key="element.code">
        {{ element.code }}
      </div>
    </template>
  </draggable>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, watch } from "vue";
import { useGameStore } from "@/stores/game";

const game = useGameStore();

// On récupère la main du joueur connecté (exemple)
const userId = game.currentUserId; // à adapter selon ton store
const cards = ref(game.hands[userId] || []);

// Écoute le store si la main change
watch(
  () => game.hands[userId],
  (newHand) => {
    cards.value = newHand || [];
  }
);

// Si tu veux gérer le drag & drop côté store, il faudra "sync" cards.value après drag
function onEnd() {
  game.updateHand(userId, cards.value);
}
</script>

<style scoped>
.player-hand {
  display: flex;
  gap: 8px;
}

.card {
  padding: 8px 12px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  user-select: none;
  cursor: grab;
}
</style>
