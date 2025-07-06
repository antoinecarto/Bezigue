<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game.ts";
import draggable from "vuedraggable";
import PlayingCard from "@/components/PlayingCard.vue"; // adapte le chemin si besoin

const game = useGameStore();

// Pour la zone des combinaisons (meldArea)
const meldArea = computed(() => game.meldArea);

// Optionnel : gestion du drop (adapter selon ta logique)
function onDrop(evt: any) {
  // evt contient infos sur la source, destination, etc.
  // ici tu peux mettre à jour le store ou appeler une action
  console.log("drop event", evt);
}
</script>

<template>
  <draggable
    v-model="game.meldArea"
    group="cards"
    @end="onDrop"
    class="drop-zone"
  >
    <template #item="{ element }">
      <PlayingCard :code="element" width="60" height="90" />
    </template>
  </draggable>

  <span v-if="!game.meldArea.length">Aucune</span>
</template>

<style scoped>
.drop-zone {
  min-height: 100px;
  border: 2px dashed #ccc;
  padding: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
