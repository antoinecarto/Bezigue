<script setup lang="ts">
import { computed } from "vue";
import { useGameStore } from "@/stores/game.ts";
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";

const props = defineProps({
  isOpponent: {
    type: Boolean,
    default: false,
  },
});

const game = useGameStore();

// Choisir la zone de meld à afficher selon isOpponent
const meldArea = computed(() => {
  return props.isOpponent ? game.opponentMeldArea : game.meldArea;
});

function onDrop(evt: any) {
  console.log("drop event", evt);
  // À adapter selon ta logique, par exemple appeler une action store pour mettre à jour les melds
}
</script>

<template>
  <draggable
    v-model="meldArea"
    group="cards"
    @end="onDrop"
    class="drop-zone"
    :disabled="props.isOpponent"
  >
    <template #item="{ element }">
      <PlayingCard :code="element" width="60" height="90" />
    </template>
  </draggable>

  <span v-if="meld?.length > 0">>Aucune</span>
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
