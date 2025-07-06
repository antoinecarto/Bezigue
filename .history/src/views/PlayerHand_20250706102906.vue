<template>
  <draggable
    v-model="cards"
    item-key="code"
    :animation="200"
    class="player-hand"
    :group="{ name: 'cards' }"
    @end="onEnd"
  >
    <template #item="{ element }">
      <div class="card" :key="element.code">
        {{ element.code }}
      </div>
    </template>
  </draggable>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import { ref, watch, computed } from "vue";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";

const game = useGameStore();
const { myUid, hand } = storeToRefs(game);

// userId est une computed pour suivre myUid de manière réactive
const userId = computed(() => myUid.value);

// cards, main du joueur courant, initialisée vide ou avec la main
const cards = ref<string[]>([]);

// Mise à jour automatique de cards quand myUid ou hand change
watch(
  [userId, hand],
  ([newUserId, newHand]) => {
    if (newUserId && newHand) {
      cards.value = newHand; // ici newHand est la main complète, adapter si besoin
    } else {
      cards.value = [];
    }
  },
  { immediate: true }
);

// Gestion du drag end pour sync avec le store
function onEnd() {
  if (userId.value) {
    game.updateHand(userId.value, cards.value);
  }
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
